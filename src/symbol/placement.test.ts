import {beforeEach, describe, expect, test, vi} from 'vitest';
import {Placement, RetainedQueryData} from './placement.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import {CollisionBoxArray, SymbolInstanceArray} from '../data/array_types.g.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {Tile} from '../tile/tile.ts';
import {FeatureIndex} from '../data/feature_index.ts';
import {CrossTileSymbolIndex} from './cross_tile_symbol_index.ts';
import {performSymbolLayout} from './symbol_layout.ts';
import {createGlyphMap, createSymbolBucket} from '../../test/unit/lib/create_symbol_layer.ts';
import {createPopulateOptions, loadVectorTile} from '../../test/unit/lib/tile.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';

import type {IndexedFeature} from '../data/bucket.ts';
import type {EvaluationParameters} from '../style/evaluation_parameters.ts';

describe('placement', () => {
    let placement: Placement;
    let transform: MercatorTransform;
    beforeEach(() => {
        transform = new MercatorTransform();
        transform.resize(512, 512);
        placement = new Placement(transform, undefined, 0, true);
    });

    test('should not throw on integer overflow', () => {
        const layer = new SymbolStyleLayer({
            id: 'contour-label',
            type: 'symbol',
            source: 'contours',
            'source-layer': 'contours',
            layout: {
                'text-font': ['Test'],
                'text-field': 'test',
                'symbol-placement': 'line'
            },
        }, {});
        layer.recalculate({zoom: 22, zoomHistory: {}} as EvaluationParameters, undefined);
        const tileId = new OverscaledTileID(22, 0, 12, 2447, 1666);
        const bucketInstanceId = 1;
        placement.retainedQueryData[bucketInstanceId] = new RetainedQueryData(
            bucketInstanceId,
            new FeatureIndex(tileId),
            0,
            0,
            tileId
        );
        const bucket = {
            bucketInstanceId,
            symbolInstances: new SymbolInstanceArray(),
            collisionArrays: {0: new CollisionBoxArray()},
        };
        const int16Overflow = Math.pow(2, 15) + 1;
        bucket.symbolInstances.emplaceBack(0, 0, 0, int16Overflow, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0);
        bucket.symbolInstances.get(0).crossTileID = 1;
        expect(() => {
            placement.placeLayerBucketPart({
                symbolInstanceStart: 0,
                symbolInstanceEnd: 1,
                parameters: {
                    layout: layer.layout,
                    bucket
                } as any
            }, {}, false);
        }).not.toThrow();
    });

    describe('updateLayerOpacities', () => {
        const collisionBoxArray = new CollisionBoxArray();
        const glyphFixture = createGlyphMap();

        function setupTilesSharingOneLabel(count = 2) {
            const sourceLayer = loadVectorTile().layers.place_label;
            const features = [{feature: sourceLayer.feature(10)} as unknown as IndexedFeature];
            const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

            const buckets = Array.from({length: count}, () => {
                const bucket = createSymbolBucket('test', 'Test', 'abcde', collisionBoxArray,
                    {'text-allow-overlap': true, 'text-ignore-placement': true});
                bucket.populate(features, createPopulateOptions([]), undefined);
                performSymbolLayout({
                    bucket,
                    glyphMap: glyphFixture,
                    glyphPositions: glyphFixture,
                    subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
                } as any);
                return bucket;
            });

            const tiles = buckets.map(bucket => {
                const tile = new Tile(tileID, 512);
                tile.latestFeatureIndex = new FeatureIndex(tileID);
                tile.buckets = {test: bucket};
                tile.collisionBoxArray = collisionBoxArray;
                return tile;
            });

            const layer = buckets[0].layers[0];
            const index = new CrossTileSymbolIndex();
            index.addLayer(layer, tiles, 0);
            return {tiles, buckets, layer, index};
        }

        test('reuses buckets that already have their opacities written', () => {
            const {tiles, buckets, layer} = setupTilesSharingOneLabel();
            placement.updateLayerOpacities(layer, tiles);
            const opacities = buckets[0].text.opacityVertexArray.uint32.slice();

            const spy = vi.spyOn(placement, 'updateBucketOpacities');
            placement.updateLayerOpacities(layer, tiles, new Set());
            expect(spy).not.toHaveBeenCalled();
            expect(buckets[0].text.opacityVertexArray.uint32).toEqual(opacities);
        });

        test('rebuilds a bucket the index just reindexed', () => {
            const {tiles, buckets, layer} = setupTilesSharingOneLabel();
            placement.updateLayerOpacities(layer, tiles);

            const spy = vi.spyOn(placement, 'updateBucketOpacities');
            placement.updateLayerOpacities(layer, tiles, new Set([buckets[1].bucketInstanceId]));
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toBe(buckets[1]);
        });

        test('reuse produces the same buffers as rebuilding everything, over tiles arriving and leaving', () => {
            const makeWorld = (reuse: boolean) => {
                const world = {...setupTilesSharingOneLabel(3), reuse, placement: new Placement(transform, undefined, 0, true)};
                for (const tile of world.tiles) {
                    const parts = [];
                    world.placement.getBucketParts(parts, world.layer, tile, false);
                    for (const part of parts) world.placement.placeLayerBucketPart(part, {}, false);
                }
                world.placement.commit(0);
                return world;
            };

            const snapshot = (world: ReturnType<typeof makeWorld>) => world.buckets.map(({text}) => [
                Array.from(text.opacityVertexArray.uint32.subarray(0, text.opacityVertexArray.length)),
                Array.from(text.placedSymbolArray.uint8),
                Array.from(text.indexArray.uint16)
            ]);

            const full = makeWorld(false);
            const reused = makeWorld(true);

            full.placement.updateLayerOpacities(full.layer, full.tiles);
            const initial = snapshot(full);
            expect(initial[0][0].length).toBeGreaterThan(0);
            expect(initial[0]).not.toEqual(initial[1]);

            const visibleTileSets = [[0, 1, 2], [0, 1, 2], [1, 2], [0, 1, 2], [2], [0, 2], [0, 1, 2]];
            for (const [step, indexes] of visibleTileSets.entries()) {
                for (const world of [full, reused]) {
                    const tiles = indexes.map(i => world.tiles[i]);
                    const reindexed = new Set<number>();
                    world.index.addLayer(world.layer, tiles, 0, reindexed);
                    world.placement.updateLayerOpacities(world.layer, tiles, world.reuse ? reindexed : null);
                }
                expect(snapshot(reused), `step ${step}: [${indexes}]`).toEqual(snapshot(full));
            }
        });
    });
});

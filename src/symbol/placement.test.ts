import {beforeEach, describe, expect, test} from 'vitest';
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
import type {SymbolBucket} from '../data/bucket/symbol_bucket.ts';

/** What `packOpacity` writes for a symbol that is fully shown, and for one that is fully hidden. */
const PACKED_VISIBLE_OPACITY = 4294967295;
const PACKED_HIDDEN_OPACITY = 0;

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
            return {tiles, buckets, layer};
        }

        const packedOpacityOf = (bucket: SymbolBucket) => bucket.text.opacityVertexArray.uint32[0];
        const SENTINEL = 12345;

        test('the first bucket draws a shared label and the rest hide it', () => {
            const {tiles, buckets, layer} = setupTilesSharingOneLabel();
            placement.updateLayerOpacities(layer, tiles);

            expect(packedOpacityOf(buckets[0])).toBe(PACKED_VISIBLE_OPACITY);
            expect(packedOpacityOf(buckets[1])).toBe(PACKED_HIDDEN_OPACITY);
        });

        test('leaves the opacity buffers alone when nothing changed', () => {
            const {tiles, buckets, layer} = setupTilesSharingOneLabel();
            placement.updateLayerOpacities(layer, tiles);

            for (const bucket of buckets) bucket.text.opacityVertexArray.uint32[0] = SENTINEL;
            placement.updateLayerOpacities(layer, tiles);

            for (const bucket of buckets) expect(packedOpacityOf(bucket)).toBe(SENTINEL);
        });

        test('rewrites only the bucket the index reindexed', () => {
            const {tiles, buckets, layer} = setupTilesSharingOneLabel();
            placement.updateLayerOpacities(layer, tiles);

            for (const bucket of buckets) bucket.text.opacityVertexArray.uint32[0] = SENTINEL;
            placement.updateLayerOpacities(layer, tiles, new Set([buckets[1].bucketInstanceId]));

            expect(packedOpacityOf(buckets[0])).toBe(SENTINEL);
            expect(packedOpacityOf(buckets[1])).toBe(PACKED_HIDDEN_OPACITY);
        });

        test('rewrites a bucket whose label another bucket stopped hiding', () => {
            const {tiles, buckets, layer} = setupTilesSharingOneLabel();
            placement.updateLayerOpacities(layer, tiles);

            placement.updateLayerOpacities(layer, tiles.slice(1));

            expect(packedOpacityOf(buckets[1])).toBe(PACKED_VISIBLE_OPACITY);
        });
    });
});

import fs from 'fs';
import path from 'path';
import {beforeEach, describe, expect, test} from 'vitest';
import {PACKED_HIDDEN_OPACITY, PACKED_VISIBLE_OPACITY, Placement, RetainedQueryData} from './placement.ts';
import {createTestCamera} from '../util/test/util.ts';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import {CollisionBoxArray, SymbolInstanceArray} from '../data/array_types.g.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {FeatureIndex} from '../data/feature_index.ts';
import {CrossTileSymbolIndex} from './cross_tile_symbol_index.ts';
import {createGlyphMap, createSymbolTile} from '../../test/unit/lib/create_symbol_layer.ts';
import {createPopulateOptions, loadVectorTile} from '../../test/unit/lib/tile.ts';
import {SymbolBucket} from '../data/bucket/symbol_bucket.ts';
import {Tile} from '../tile/tile.ts';
import {DictionaryCoder} from '../util/dictionary_coder.ts';
import {performSymbolLayout} from './symbol_layout.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';

import type {BucketParameters, IndexedFeature} from '../data/bucket.ts';
import type {EvaluationParameters} from '../style/evaluation_parameters.ts';
import type {BucketPart} from './placement.ts';
import type {TestCameraOptions} from '../util/test/util.ts';
import type {FilterSpecification} from '@maplibre/maplibre-gl-style-spec';

const collisionBoxArray = new CollisionBoxArray();

/**
 * Two tiles at the same tile ID, each with a symbol bucket holding the same one label, so
 * that the cross tile index gives both buckets the same cross tile ID for it.
 */
function setupTwoTilesSharingOneLabel() {
    const features = [{feature: loadVectorTile().layers.place_label.feature(10)} as unknown as IndexedFeature];
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const tiles = Array.from({length: 2}, () => createSymbolTile(tileID, features, collisionBoxArray,
        {'text-allow-overlap': true, 'text-ignore-placement': true}));
    const buckets = tiles.map(tile => tile.buckets.test as SymbolBucket);

    const layer = buckets[0].layers[0];
    new CrossTileSymbolIndex().addLayer(layer, tiles, 0);
    return {tiles, buckets, layer};
}

/**
 * A tile holding the fixture's Rochester label, which lies just north-west of the center of the tile, drawn by a symbol
 * layer with `filter` that always shows it unless the filter hides it. The tile keeps its data, the way a loaded tile
 * does, so that placement can read the label's feature back.
 */
function createFilteredSymbolTile(filter: FilterSpecification) {
    const tileData = fs.readFileSync(path.resolve(__dirname, '../../test/unit/assets/mbsv5-6-18-23.vector.pbf'));
    const vectorTile = loadVectorTile();
    const sourceLayerIndex = new DictionaryCoder(Object.keys(vectorTile.layers).sort()).encode('place_label');

    const layer = new SymbolStyleLayer({
        id: 'test',
        type: 'symbol',
        source: 'source',
        'source-layer': 'place_label',
        filter,
        layout: {'text-font': ['Test'], 'text-field': 'abcde', 'text-allow-overlap': true}
    }, {});
    layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

    const bucket = new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray,
        layers: [layer],
        index: 0,
        sourceLayerIndex
    } as BucketParameters<SymbolStyleLayer>);
    const feature = {feature: vectorTile.layers.place_label.feature(10), index: 10, sourceLayerIndex} as unknown as IndexedFeature;
    bucket.populate([feature], createPopulateOptions([]), undefined);
    const glyphMap = createGlyphMap();
    performSymbolLayout({
        bucket,
        glyphMap,
        glyphPositions: glyphMap,
        subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
    } as any);

    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const tile = new Tile(tileID, 512);
    tile.latestFeatureIndex = new FeatureIndex(tileID);
    tile.latestFeatureIndex.rawTileData = tileData.buffer.slice(tileData.byteOffset, tileData.byteOffset + tileData.byteLength);
    tile.buckets = {test: bucket};
    tile.collisionBoxArray = collisionBoxArray;
    new CrossTileSymbolIndex().addLayer(layer, [tile], 0);
    return {tile, layer, bucket};
}

/** Whether placing the tile's symbols under a camera with `options` shows the tile's one label. */
function isLabelPlaced(tile: Tile, layer: SymbolStyleLayer, bucket: SymbolBucket, options: TestCameraOptions): boolean {
    const placement = new Placement(createTestCamera({width: 512, height: 512, ...options}).projectedCamera, undefined, 0, true);
    const parts: BucketPart[] = [];
    placement.getBucketParts(parts, layer, tile, false);
    for (const part of parts) placement.placeLayerBucketPart(part, {}, false);
    return placement.placements[bucket.symbolInstances.get(0).crossTileID].text;
}

/** Written over a packed opacity, so that finding it again means the buffer was not rewritten. */
const SENTINEL = 12345;

describe('placement', () => {
    let placement: Placement;
    beforeEach(() => {
        placement = new Placement(createTestCamera({width: 512, height: 512}).projectedCamera, undefined, 0, true);
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
            layers: [layer],
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

    test('shows a symbol only while its filter holds for the camera pitch and the symbol feature', () => {
        const {tile, layer, bucket} = createFilteredSymbolTile(['all', ['==', ['get', 'name'], 'Rochester'], ['>', ['pitch'], 30]]);

        expect(isLabelPlaced(tile, layer, bucket, {pitch: 0})).toBe(false);
        expect(isLabelPlaced(tile, layer, bucket, {pitch: 45})).toBe(true);
    });

    test('measures distance-from-center up the screen in units of its height', () => {
        // The label sits 245 pixels from the top of a 512 pixel high screen: 0.5 - 245 / 512 = 0.021 above the middle.
        const {tile, layer, bucket} = createFilteredSymbolTile(['all', ['>', ['distance-from-center'], 0.01], ['<', ['distance-from-center'], 0.03]]);

        expect(isLabelPlaced(tile, layer, bucket, {bearing: 0})).toBe(true);
        expect(isLabelPlaced(tile, layer, bucket, {bearing: 180})).toBe(false);
    });

    test('the first bucket draws the shared label and the second hides it', () => {
        const {tiles, buckets, layer} = setupTwoTilesSharingOneLabel();
        placement.updateLayerOpacities(layer, tiles);

        expect(buckets[0].text.opacityVertexArray.uint32[0]).toBe(PACKED_VISIBLE_OPACITY);
        expect(buckets[1].text.opacityVertexArray.uint32[0]).toBe(PACKED_HIDDEN_OPACITY);
    });

    test('leaves the opacity buffers alone when the same tiles come round again', () => {
        const {tiles, buckets, layer} = setupTwoTilesSharingOneLabel();
        placement.updateLayerOpacities(layer, tiles);

        for (const bucket of buckets) bucket.text.opacityVertexArray.uint32[0] = SENTINEL;
        placement.updateLayerOpacities(layer, tiles);

        for (const bucket of buckets) expect(bucket.text.opacityVertexArray.uint32[0]).toBe(SENTINEL);
    });

    test('rewrites a bucket whose cross tile IDs were reassigned', () => {
        const {tiles, buckets, layer} = setupTwoTilesSharingOneLabel();
        placement.updateLayerOpacities(layer, tiles);

        for (const bucket of buckets) bucket.text.opacityVertexArray.uint32[0] = SENTINEL;
        // Reindexing hands out fresh IDs. The same bucket still draws the label, so only the
        // cross tile IDs differ from what was recorded, not the duplicate flags.
        for (const bucket of buckets) bucket.symbolInstances.get(0).crossTileID = 9999;
        placement.updateLayerOpacities(layer, tiles);

        expect(buckets[0].text.opacityVertexArray.uint32[0]).toBe(PACKED_VISIBLE_OPACITY);
        expect(buckets[1].text.opacityVertexArray.uint32[0]).toBe(PACKED_HIDDEN_OPACITY);
    });

    test('rewrites a bucket once the bucket that was hiding its label is gone', () => {
        const {tiles, buckets, layer} = setupTwoTilesSharingOneLabel();
        placement.updateLayerOpacities(layer, tiles);
        expect(buckets[1].text.opacityVertexArray.uint32[0]).toBe(PACKED_HIDDEN_OPACITY);

        // The first tile drops out, so the second bucket now has to draw the label itself.
        placement.updateLayerOpacities(layer, tiles.slice(1));

        expect(buckets[1].text.opacityVertexArray.uint32[0]).toBe(PACKED_VISIBLE_OPACITY);
    });
});

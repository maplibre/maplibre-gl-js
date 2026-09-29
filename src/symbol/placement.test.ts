import {beforeEach, describe, expect, test} from 'vitest';
import {PACKED_HIDDEN_OPACITY, PACKED_VISIBLE_OPACITY, Placement, RetainedQueryData} from './placement.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import {CollisionBoxArray, SymbolInstanceArray} from '../data/array_types.g.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {FeatureIndex} from '../data/feature_index.ts';
import {CrossTileSymbolIndex} from './cross_tile_symbol_index.ts';
import {createSymbolTile} from '../../test/unit/lib/create_symbol_layer.ts';
import {loadVectorTile} from '../../test/unit/lib/tile.ts';

import type {IndexedFeature} from '../data/bucket.ts';
import type {SymbolBucket} from '../data/bucket/symbol_bucket.ts';
import type {EvaluationParameters} from '../style/evaluation_parameters.ts';

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

/** Written over a packed opacity, so that finding it again means the buffer was not rewritten. */
const SENTINEL = 12345;

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

    test('grows text collision boxes when a composite text-size draws larger than the baked size', () => {
        // A composite (zoom + feature data) text-size decreasing with zoom: the collision box is
        // baked on the worker for the size at (tileZoom + 1), but the shader draws the text at the
        // fractional render zoom, which is larger. The box must grow to match, or overlapping
        // labels are both placed. See https://github.com/maplibre/maplibre-gl-js/issues/5677
        const sizeProperty = {size: 10};
        const features = [
            {feature: {extent: 8192, type: 1, id: 0, properties: sizeProperty, loadGeometry: () => [[{x: 4000, y: 4000}]]}, id: 0, index: 0, sourceLayerIndex: 0},
            {feature: {extent: 8192, type: 1, id: 1, properties: sizeProperty, loadGeometry: () => [[{x: 4700, y: 4000}]]}, id: 1, index: 1, sourceLayerIndex: 0},
        ] as unknown as IndexedFeature[];
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const tile = createSymbolTile(tileID, features, new CollisionBoxArray(), {
            'text-size': ['interpolate', ['linear'], ['zoom'], 0, ['*', ['get', 'size'], 2], 1, ['get', 'size']],
        } as any);
        const bucket = tile.buckets.test as SymbolBucket;
        const layer = bucket.layers[0];
        new CrossTileSymbolIndex().addLayer(layer, [tile], 0);

        const parts = [];
        placement.getBucketParts(parts, layer, tile, false);
        for (const part of parts) {
            placement.placeLayerBucketPart(part, {}, false);
        }

        // The labels are 700 tile units apart. Their boxes are baked for text size 10 (width 496),
        // so they do not overlap; but the text is drawn at size 20 and the grown boxes (width 928)
        // do, so the second label must not be placed.
        const placements = Object.values(placement.placements);
        expect(placements).toHaveLength(2);
        expect(placements[0].text).toBe(true);
        expect(placements[1].text).toBe(false);
    });
});

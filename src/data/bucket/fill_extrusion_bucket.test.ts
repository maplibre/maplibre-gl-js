import {beforeAll, describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {FillExtrusionBucket} from './fill_extrusion_bucket.ts';
import {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import type {ZoomHistory} from '../../style/zoom_history.ts';
import type {BucketFeature, BucketParameters} from '../bucket.ts';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

function createFillExtrusionBucket({id, layout, paint, globalState, availableImages}: CreateBucketParameters): FillExtrusionBucket {
    const layer = new FillExtrusionStyleLayer({
        id,
        type: 'fill-extrusion',
        layout,
        paint
    } as LayerSpecification, globalState);
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters,
        availableImages);

    return new FillExtrusionBucket({layers: [layer]} as BucketParameters<FillExtrusionStyleLayer>);
}

/** Returns a bucket holding one polygon with the outer ring `ring`, given as `[x, y]` pairs in tile units. */
function createBucketWithRing(ring: number[][], layout: CreateBucketParameters['layout'] = {}): FillExtrusionBucket {
    const bucket = createFillExtrusionBucket({id: 'test', layout, paint: {'fill-extrusion-height': 10}});
    const geometry = [ring.map(([x, y]) => new Point(x, y))];
    const feature = {id: 0, index: 0, sourceLayerIndex: 0, geometry, properties: {}, type: 3, patterns: {}} as BucketFeature;
    bucket.addFeature(feature, geometry, 0, new CanonicalTileID(0, 0, 0), {}, SubdivisionGranularitySetting.noSubdivision);
    return bucket;
}

/** Returns the `a_normal_ed` z component at the first and at the second end of each of the first `wallCount` walls. */
function wallEnds(bucket: FillExtrusionBucket, wallCount: number): number[][] {
    const int16 = bucket.layoutVertexArray.int16;
    return Array.from({length: wallCount}, (_, wall) => [int16[(wall * 4) * 6 + 4], int16[(wall * 4 + 2) * 6 + 4]]);
}

describe('FillExtrusionBucket', () => {
    let sourceLayer: VectorTileLayerLike;
    beforeAll(() => {
        // Load fill extrusion features from fixture tile.
        sourceLayer = loadVectorTile().layers.water;
    });

    test('FillExtrusionBucket fill-pattern with global-state', () => {
        const availableImages = [];
        const bucket = createFillExtrusionBucket({id: 'test',
            paint: {'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']]},
            globalState: {pattern: 'test-pattern'},
            availableImages
        });

        bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions(availableImages), undefined);

        expect(bucket.features.length).toBeGreaterThan(0);
        expect(bucket.features[0].patterns).toEqual({
            test: {min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern'}
        });
    });

    test('FillExtrusionBucket populates vertices with fill-extrusion-rounded-corner-distance layout property', () => {
        const bucketWithoutRounding = createFillExtrusionBucket({
            id: 'test-no-rounding',
            layout: {'fill-extrusion-rounded-corner-distance': 0},
            paint: {'fill-extrusion-height': 10}
        });
        const bucketWithRounding = createFillExtrusionBucket({
            id: 'test-rounding',
            layout: {'fill-extrusion-rounded-corner-distance': 5},
            paint: {'fill-extrusion-height': 10}
        });

        const features = getFeaturesFromLayer(sourceLayer);
        const populateOptions = createPopulateOptions([]);

        bucketWithoutRounding.populate(features, populateOptions, {x: 0, y: 0, z: 14} as any);
        bucketWithRounding.populate(features, populateOptions, {x: 0, y: 0, z: 14} as any);

        expect(bucketWithoutRounding.layoutVertexArray.length).toBeGreaterThan(0);
        expect(bucketWithRounding.layoutVertexArray.length).toBeGreaterThan(bucketWithoutRounding.layoutVertexArray.length);
    });

    test('FillExtrusionBucket stores the length of each wall and which of its ends are convex corners', () => {
        // An L with a concave corner at (100, 100) and a straight point at (100, 0).
        const bucket = createBucketWithRing([[0, 0], [100, 0], [200, 0], [200, 100], [100, 100], [100, 200], [0, 200], [0, 0]]);

        expect(wallEnds(bucket, 7)).toEqual([
            [2 * 100, -(2 * 100 + 1)],
            [2 * 100 + 1, -(2 * 100)],
            [2 * 100 + 1, -(2 * 100 + 1)],
            [2 * 100, -(2 * 100 + 1)],
            [2 * 100 + 1, -(2 * 100)],
            [2 * 100 + 1, -(2 * 100 + 1)],
            [2 * 200 + 1, -(2 * 200 + 1)]
        ]);
    });

    test('FillExtrusionBucket stores a wall normal that turns left into the direction from the first end to the second', () => {
        const bucket = createBucketWithRing([[0, 0], [100, 0], [150, 100], [0, 0]]);
        const int16 = bucket.layoutVertexArray.int16;

        for (let wall = 0; wall < 3; wall++) {
            const first = wall * 4 * 6;
            const second = (wall * 4 + 2) * 6;
            const inward = new Point(int16[first + 2] >> 1, int16[first + 3] / 2)._unit();
            const along = new Point(-inward.y, inward.x);
            const towardsSecond = new Point(int16[second] - int16[first], int16[second + 1] - int16[first + 1]);

            expect(int16[first + 4]).toBeGreaterThan(0);
            expect(along.dist(towardsSecond._unit())).toBeLessThan(1e-3);
        }
    });

    test('FillExtrusionBucket gives a wall next to a clip edge no convex end there', () => {
        const bucket = createBucketWithRing([[-64, 0], [100, 0], [100, 100], [-64, 100], [-64, 0]]);

        expect(wallEnds(bucket, 3)).toEqual([
            [2 * 164 + 1, -(2 * 164)],
            [2 * 100 + 1, -(2 * 100 + 1)],
            [2 * 164, -(2 * 164 + 1)]
        ]);
    });

    test('FillExtrusionBucket clamps the stored length of a wall longer than the normal can hold', () => {
        const bucket = createBucketWithRing([[0, 0], [20000, 0], [20000, 100], [0, 100], [0, 0]]);

        expect(wallEnds(bucket, 1)).toEqual([[2 * 16383, -(2 * 16383 + 1)]]);
    });

    test('FillExtrusionBucket marks no convex ends where fill-extrusion-rounded-corner-distance smooths the walls', () => {
        const bucket = createBucketWithRing([[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]], {'fill-extrusion-rounded-corner-distance': 5});

        expect(wallEnds(bucket, 4).flat().every(data => (Math.abs(data) & 1) === 0)).toBe(true);
    });

    test('FillExtrusionBucket stores the roof normal (0, 0, 1) as xy = (1, 0), which no wall uses', () => {
        const bucket = createBucketWithRing([[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]);
        const int16 = bucket.layoutVertexArray.int16;
        const normals = Array.from({length: bucket.layoutVertexArray.length}, (_, i) => [int16[i * 6 + 2], int16[i * 6 + 3], int16[i * 6 + 4]]);

        const roof = normals.slice(16);

        expect(normals.slice(0, 16).some(([x, y]) => x === 1 && y === 0)).toBe(false);
        expect(roof.length).toBeGreaterThan(0);
        expect(roof).toEqual(Array(roof.length).fill([1, 0, 16384]));
    });
});

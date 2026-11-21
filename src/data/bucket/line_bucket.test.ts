import {beforeAll, describe, test, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {SegmentVector} from '../segment.ts';
import {LineBucket} from './line_bucket.ts';
import {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import type {ZoomHistory} from '../../../src/style/zoom_history.ts';
import type {BucketFeature, BucketParameters} from '../bucket.ts';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

const {noSubdivision} = SubdivisionGranularitySetting;

function createLine(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(new Point(i / numPoints, i / numPoints));
    }
    return points;
}

function createLineBucket({id, layout, paint, globalState, availableImages}: CreateBucketParameters): LineBucket {
    const layer = new LineStyleLayer({
        id,
        type: 'line',
        layout,
        paint
    } as LayerSpecification, globalState);
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters,
        availableImages);

    return new LineBucket({layers: [layer]} as BucketParameters<LineStyleLayer>);
}

/**
 * Returns where `line-offset` moves the vertices on one side of the line, in the order they were added.
 * Positions are in tile units, for an offset of `offset` tile units.
 */
function offsetVertexPositions(bucket: LineBucket, up: boolean, offset: number): Point[] {
    const {int16, int8} = bucket.layoutVertexArray;
    const positions = [];
    for (let i = 0; i < bucket.layoutVertexArray.length; i++) {
        if (((int16[i * 5 + 1] & 1) === 1) !== up) continue;
        const position = new Point(int16[i * 5] >> 1, int16[i * 5 + 1] >> 1);
        const offsetNormal = new Point(int8[i * 10 + 8], int8[i * 10 + 9]).div(63);
        positions.push(position.add(offsetNormal.mult(offset)));
    }
    return positions;
}

describe('LineBucket', () => {
    let sourceLayer: VectorTileLayerLike;
    beforeAll(() => {
        // Load line features from fixture tile.
        sourceLayer = loadVectorTile().layers.road;
    });
    test('LineBucket', () => {
        expect(() => {
            const bucket = createLineBucket({
                id: 'test'
            });

            const line = {
                type: 2,
                properties: {}
            } as BucketFeature;

            const polygon = {
                type: 3,
                properties: {}
            } as BucketFeature;

            bucket.addLine([
                new Point(0, 0)
            ], line, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0)
            ], polygon, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0),
                new Point(0, 0)
            ], line, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0),
                new Point(0, 0)
            ], polygon, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(0, 0)
            ], line, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(0, 0)
            ], polygon, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20)
            ], line, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20)
            ], polygon, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20),
                new Point(0, 0)
            ], line, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            bucket.addLine([
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20),
                new Point(0, 0)
            ], polygon, undefined, undefined, undefined, undefined, undefined, noSubdivision);

            const feature = sourceLayer.feature(0);
            bucket.addFeature(feature as any, feature.loadGeometry(), undefined, undefined, undefined, undefined, noSubdivision);
        }).not.toThrow();
    });

    test('LineBucket segmentation', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
        // breaking across array groups without tests taking a _long_ time.
        SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 256;

        const bucket = createLineBucket({
            id: 'test'
        });

        // first add an initial, small feature to make sure the next one starts at
        // a non-zero offset
        bucket.addFeature({} as BucketFeature, [createLine(10)], undefined, undefined, undefined, undefined, noSubdivision);

        // add a feature that will break across the group boundary
        bucket.addFeature({} as BucketFeature, [createLine(128)], undefined, undefined, undefined, undefined, noSubdivision);

        // Each polygon must fit entirely within a segment, so we expect the
        // first segment to include the first feature and the first polygon
        // of the second feature, and the second segment to include the
        // second polygon of the second feature.
        expect(bucket.layoutVertexArray).toHaveLength(276);
        expect(bucket.segments.get()).toEqual([{
            vertexOffset: 0,
            vertexLength: 20,
            vaos: {},
            primitiveOffset: 0,
            primitiveLength: 18
        }, {
            vertexOffset: 20,
            vertexLength: 256,
            vaos: {},
            primitiveOffset: 18,
            primitiveLength: 254
        }]);

        expect(console.warn).toHaveBeenCalledTimes(1);

    });

    test('LineBucket line-pattern with global-state', () => {
        const availableImages = [];
        const bucket = createLineBucket({id: 'test',
            paint: {'line-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']]},
            globalState: {pattern: 'test-pattern'},
            availableImages
        });

        bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions(availableImages), undefined);

        expect(bucket.patternFeatures.length).toBeGreaterThan(0);
        expect(bucket.patternFeatures[0].patterns).toEqual({
            test: {min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern'}
        });
    });

    test('LineBucket line-dasharray with global-state', () => {
        const bucket = createLineBucket({id: 'test',
            paint: {'line-dasharray': ['coalesce', ['get', 'dasharray'], ['global-state', 'dasharray']]},
            globalState: {'dasharray': [3, 3]},
            availableImages: []
        });

        bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions([]), undefined);

        expect(bucket.patternFeatures.length).toBeGreaterThan(0);
        expect(bucket.patternFeatures[0].dashes).toEqual({
            test: {min: '3,3,false', mid: '3,3,false', max: '3,3,false'}
        });
    });

    test('LineBucket keeps an offset line from folding back at a sharp corner', () => {
        const layer = new LineStyleLayer({id: 'test', type: 'line'} as LayerSpecification, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
        const bucket = new LineBucket({layers: [layer], overscaling: 1} as BucketParameters<LineStyleLayer>);
        const line = {type: 2, properties: {}} as BucketFeature;

        // A right angle adds a vertex 240 tile units before and after the corner; an offset of 512 moves
        // the corner on the inside of the turn past both of them.
        bucket.addLine([
            new Point(0, 0),
            new Point(1000, 0),
            new Point(1000, 1000)
        ], line, 'miter', 'butt', 2, 1.05, undefined, noSubdivision);

        for (const up of [false, true]) {
            const positions = offsetVertexPositions(bucket, up, 512);
            expect(positions).toHaveLength(5);
            for (let i = 1; i < positions.length; i++) {
                expect(positions[i].x).toBeGreaterThanOrEqual(positions[i - 1].x - 1);
                expect(positions[i].y).toBeGreaterThanOrEqual(positions[i - 1].y - 1);
            }
        }
    });

    test('LineBucket stores how much shorter a dashed offset line is on the inside of a turn', () => {
        const layer = new LineStyleLayer({id: 'test', type: 'line', source: 'test', paint: {'line-dasharray': [2, 2], 'line-offset': 4}}, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
        const bucket = new LineBucket({layers: [layer], overscaling: 1} as BucketParameters<LineStyleLayer>);

        bucket.addFeature({type: 2, properties: {}} as BucketFeature, [[
            new Point(0, 0),
            new Point(1000, 0),
            new Point(1000, 1000)
        ]], 0, undefined, {}, {}, noSubdivision);

        // Offsetting a right angle to the inside cuts one offset off each of its two segments. The vertices
        // around the corner move with it, so the line shortens at the corner and again at the far end.
        const expected = [0, 0, -1, -1, -1, -1, -1, -1, -2, -2];
        expect(bucket.offsetDistanceArray).toHaveLength(expected.length);
        for (let i = 0; i < expected.length; i++) {
            expect(bucket.offsetDistanceArray.float32[i]).toBeCloseTo(expected[i]);
        }
    });

    test('LineBucket stores no offset distances for lines without both dashes and an offset', () => {
        expect(createLineBucket({id: 'test', paint: {'line-dasharray': [2, 2]}}).offsetDistanceArray).toBeUndefined();
        expect(createLineBucket({id: 'test', paint: {'line-offset': 4}}).offsetDistanceArray).toBeUndefined();
        expect(createLineBucket({id: 'test', paint: {'line-dasharray': [2, 2], 'line-offset': 4}}).offsetDistanceArray).toBeDefined();
    });

    test('LineBucket ignores geometry with insufficient unique vertices after trimming duplicates', () => {
        const bucket = createLineBucket({id: 'test'});

        const line = {
            type: 2,
            properties: {}
        } as BucketFeature;

        const polygon = {
            type: 3,
            properties: {}
        } as BucketFeature;

        bucket.addLine([
            new Point(0, 0),
            new Point(0, 0),
            new Point(0, 0)
        ], line, undefined, undefined, undefined, undefined, undefined, noSubdivision);

        bucket.addLine([
            new Point(0, 0),
            new Point(0, 0),
            new Point(10, 10),
            new Point(10, 10)
        ], polygon, undefined, undefined, undefined, undefined, undefined, noSubdivision);

        bucket.addLine([
            new Point(0, 0),
            new Point(0, 0),
            new Point(0, 0),
            new Point(10, 10)
        ], polygon, undefined, undefined, undefined, undefined, undefined, noSubdivision);

        expect(bucket.isEmpty()).toBe(true);
    });
});

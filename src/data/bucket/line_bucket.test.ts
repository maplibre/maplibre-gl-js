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

    test('line-offset leaves centerline distance unchanged when offset is zero', () => {
        const bucket = createAngledLineBucket(0);
        addRightAngle(bucket);
        expect(bucket.distance).toBe(8000);
    });

    test('line-offset does not change linesofar on a straight segment', () => {
        const line = {type: 2, properties: {}} as BucketFeature;
        const noOffset = createAngledLineBucket(0);
        noOffset.addLine([
            new Point(0, 0),
            new Point(4000, 0)
        ], line, 'miter', 'butt', 2, 1.05, undefined, noSubdivision);
        const withOffset = createAngledLineBucket(-32);
        withOffset.addLine([
            new Point(0, 0),
            new Point(4000, 0)
        ], line, 'miter', 'butt', 2, 1.05, undefined, noSubdivision);
        expect(withOffset.distance).toBe(noOffset.distance);
    });

    test('line-offset follows the offset path around a corner', () => {
        const inward = createAngledLineBucket(32);
        addRightAngle(inward);
        expect(inward.distance).toBeLessThan(8000);

        const outward = createAngledLineBucket(-32);
        addRightAngle(outward);
        expect(outward.distance).toBeGreaterThan(8000);
    });

    test('sharp-corner helpers sit farther from the corner when line-offset is set', () => {
        const noOffset = createAngledLineBucket(0);
        addRightAngle(noOffset);
        const withOffset = createAngledLineBucket(-32);
        addRightAngle(withOffset);

        const corner = new Point(4000, 0);
        expect(nearestOnIncoming(withOffset, corner)).toBeGreaterThan(nearestOnIncoming(noOffset, corner));
    });
});

function createAngledLineBucket(lineOffset: number): LineBucket {
    const layer = new LineStyleLayer({
        id: 'test',
        type: 'line',
        paint: {'line-offset': lineOffset}
    } as LayerSpecification, {});
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
    return new LineBucket({layers: [layer], overscaling: 1, zoom: 0} as BucketParameters<LineStyleLayer>);
}

function addRightAngle(bucket: LineBucket) {
    const line = {
        type: 2,
        properties: {}
    } as BucketFeature;
    bucket.addLine([
        new Point(0, 0),
        new Point(4000, 0),
        new Point(4000, 4000)
    ], line, 'miter', 'butt', 2, 1.05, undefined, noSubdivision);
}

function layoutPositions(bucket: LineBucket): Point[] {
    const view = new Int16Array(bucket.layoutVertexArray.arrayBuffer);
    const seen = new Map<string, Point>();
    for (let i = 0; i < bucket.layoutVertexArray.length; i++) {
        const x = view[i * 4] >> 1;
        const y = view[i * 4 + 1] >> 1;
        seen.set(`${x},${y}`, new Point(x, y));
    }
    return [...seen.values()];
}

function nearestOnIncoming(bucket: LineBucket, corner: Point): number {
    return Math.min(...layoutPositions(bucket)
        .filter((p) => p.y === 0 && p.x < corner.x)
        .map((p) => corner.dist(p)));
}

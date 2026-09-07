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
import type {GeoJSONTaperAnnotation} from '../../source/geojson_taper.ts';
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

    test('LineBucket does not build a taper buffer when taper properties are unset', () => {
        const bucket = createLineBucket({id: 'test'});
        bucket.addLine([
            new Point(0, 0),
            new Point(10, 10),
            new Point(20, 10)
        ], {type: 2, properties: {}} as BucketFeature, 'bevel', 'butt', undefined, undefined, undefined, noSubdivision);

        expect(bucket.taperEnabled).toBe(false);
        expect(bucket.layoutTaperArray).toHaveLength(0);
    });

    test('LineBucket builds a taper buffer with normalized position along the line', () => {
        const bucket = createLineBucket({
            id: 'test',
            paint: {
                'line-width-start': 10,
                'line-width-end': 2
            }
        });

        const line = {type: 2, properties: {}} as BucketFeature;
        bucket.addLine([
            new Point(0, 0),
            new Point(10, 0),
            new Point(20, 0)
        ], line, 'bevel', 'butt', undefined, undefined, undefined, noSubdivision);

        expect(bucket.taperEnabled).toBe(true);
        // Every layout vertex gets a matching taper value.
        expect(bucket.layoutTaperArray).toHaveLength(bucket.layoutVertexArray.length);

        const taper = bucket.layoutTaperArray.float32.subarray(0, bucket.layoutTaperArray.length);
        expect(taper[0]).toBe(0);       // line start
        expect(taper[taper.length - 1]).toBe(1); // line end
        for (let i = 1; i < taper.length; i++) {
            expect(taper[i]).toBeGreaterThanOrEqual(taper[i - 1]); // monotonic
        }
        expect(taper[Math.floor(taper.length / 2)]).toBeCloseTo(0.5, 1);
    });

    test('LineBucket taper factor ignores linesofar wrap-around', () => {
        const bucket = createLineBucket({
            id: 'test',
            paint: {
                'line-width-start': 10,
                'line-width-end': 2
            }
        });

        // Long enough that the 15-bit `linesofar` would wrap around, but the taper
        // factor must keep increasing monotonically.
        const pts: Point[] = [];
        for (let i = 0; i <= 200; i++) {
            pts.push(new Point(i * 100, 0));
        }
        bucket.addLine(pts, {type: 2, properties: {}} as BucketFeature, 'bevel', 'butt', undefined, undefined, undefined, noSubdivision);

        const taper = bucket.layoutTaperArray.float32.subarray(0, bucket.layoutTaperArray.length);
        expect(taper).toHaveLength(bucket.layoutVertexArray.length);
        for (let i = 1; i < taper.length; i++) {
            expect(taper[i]).toBeGreaterThanOrEqual(taper[i - 1]);
        }
        expect(taper[taper.length - 1]).toBe(1);
    });

    test('LineBucket writes per-vertex widths from line-widths', () => {
        const bucket = createLineBucket({
            id: 'test',
            paint: {
                'line-widths': ['get', 'widths']
            }
        });

        // 3 vertices -> 2 segments of equal length, knots at 0, 0.5 and 1.
        bucket.addFeature({type: 2, properties: {widths: [2, 20, 40]}} as BucketFeature,
            [[new Point(0, 0), new Point(10, 0), new Point(20, 0)]],
            undefined, undefined, undefined, undefined, noSubdivision);

        expect(bucket.taperEnabled).toBe(true);
        expect(bucket.widthsMode).toBe(true);
        expect(bucket.layoutTaperArray).toHaveLength(bucket.layoutVertexArray.length);

        const widths = bucket.layoutTaperArray.float32.subarray(0, bucket.layoutTaperArray.length);
        // The values are interpolated along the geometry: 2 at the start, 20 in the
        // middle, 40 at the end, monotonic because the profile is monotonic.
        expect(widths[0]).toBe(2);
        expect(widths[widths.length - 1]).toBe(40);
        for (let i = 1; i < widths.length; i++) {
            expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
        }
        const mid = widths[Math.floor(widths.length / 2)];
        expect(mid).toBeCloseTo(20, 0);
    });

    test('LineBucket falls back to line-width for an empty line-widths array', () => {
        const bucket = createLineBucket({
            id: 'test',
            paint: {
                'line-width': 7,
                'line-widths': ['get', 'widths']
            }
        });

        bucket.addFeature({type: 2, properties: {widths: []}} as BucketFeature,
            [[new Point(0, 0), new Point(10, 0), new Point(20, 0)]],
            undefined, undefined, undefined, undefined, noSubdivision);

        expect(bucket.widthsMode).toBe(true);
        expect(bucket.maxVertexWidth).toBe(7);
        const widths = bucket.layoutTaperArray.float32.subarray(0, bucket.layoutTaperArray.length);
        expect(widths).toHaveLength(bucket.layoutVertexArray.length);
        for (const w of widths) {
            expect(w).toBe(7);
        }
    });

    test('LineBucket tracks the maximum vertex width for queryRadius', () => {
        const bucket = createLineBucket({
            id: 'test',
            paint: {
                'line-widths': ['get', 'widths']
            }
        });

        bucket.addFeature({type: 2, properties: {widths: [4, 12, 6]}} as BucketFeature,
            [[new Point(0, 0), new Point(10, 0), new Point(20, 0)]],
            undefined, undefined, undefined, undefined, noSubdivision);

        expect(bucket.maxVertexWidth).toBe(12);
    });

    test('tapered widths are identical at shared tile boundaries (worker annotation)', () => {
        const widths = [90, 4, 40];
        const profiles = {widths: {values: widths, knotsPerRing: [[0, 0.5, 1]]}};

        // One original line A(90px) - B(4px) - C(40px), cut halfway through the
        // B->C segment into two adjacent tile pieces. The cut lies at knot 0.75,
        // so the profile value there is 4 + (40 - 4) * 0.5 = 22 on BOTH sides.
        const bucketA = createLineBucket({id: 'test', paint: {'line-widths': ['get', 'widths']}});
        const bucketB = createLineBucket({id: 'test', paint: {'line-widths': ['get', 'widths']}});

        const annotationA: GeoJSONTaperAnnotation = {pieceKnots: [[0, 0.5, 0.75]], profiles};
        const annotationB: GeoJSONTaperAnnotation = {pieceKnots: [[0.75, 1]], profiles};

        bucketA.addFeature(
            {type: 2, properties: {widths}, _taper: annotationA} as BucketFeature,
            [[new Point(0, 0), new Point(4096, 0), new Point(6144, 0)]],
            undefined, undefined, undefined, undefined, noSubdivision);
        bucketB.addFeature(
            {type: 2, properties: {widths}, _taper: annotationB} as BucketFeature,
            [[new Point(6144, 0), new Point(8192, 0)]],
            undefined, undefined, undefined, undefined, noSubdivision);

        const uniqueValues = (bucket: LineBucket) => {
            const values = bucket.layoutTaperArray.float32.subarray(0, bucket.layoutTaperArray.length);
            const out: number[] = [];
            for (const v of values) {
                if (out.length === 0 || out[out.length - 1] !== v) out.push(v);
            }
            return out;
        };

        // Before the fix, the second piece restarted the profile at widths[0] = 90.
        expect(uniqueValues(bucketA)).toEqual([90, 4, 22]);
        expect(uniqueValues(bucketB)).toEqual([22, 40]);
    });

    test('start/end taper is continuous across tile boundaries (worker annotation)', () => {
        // line-width-start/-end has NO numeric-array property — the registry must
        // still anchor the feature, otherwise each piece restarts the taper at
        // factor 0 (the sawtooth). One original line cut at knot 0.75: both
        // pieces must evaluate the factor at the shared cut identically.
        const bucketA = createLineBucket({id: 'test', paint: {'line-width-start': 3, 'line-width-end': 40}});
        const bucketB = createLineBucket({id: 'test', paint: {'line-width-start': 3, 'line-width-end': 40}});

        const annotationA: GeoJSONTaperAnnotation = {pieceKnots: [[0, 0.5, 0.75]], profiles: {}};
        const annotationB: GeoJSONTaperAnnotation = {pieceKnots: [[0.75, 1]], profiles: {}};

        bucketA.addFeature(
            {type: 2, properties: {}, _taper: annotationA} as BucketFeature,
            [[new Point(0, 0), new Point(4096, 0), new Point(6144, 0)]],
            undefined, undefined, undefined, undefined, noSubdivision);
        bucketB.addFeature(
            {type: 2, properties: {}, _taper: annotationB} as BucketFeature,
            [[new Point(6144, 0), new Point(8192, 0)]],
            undefined, undefined, undefined, undefined, noSubdivision);

        const uniqueValues = (bucket: LineBucket) => {
            const values = bucket.layoutTaperArray.float32.subarray(0, bucket.layoutTaperArray.length);
            const out: number[] = [];
            for (const v of values) {
                if (out.length === 0 || out[out.length - 1] !== v) out.push(v);
            }
            return out;
        };

        // start/end mode stores the factor itself; before the fix the second
        // piece restarted at factor 0 (which the shader would render as start-width).
        expect(uniqueValues(bucketA)).toEqual([0, 0.5, 0.75]);
        expect(uniqueValues(bucketB)).toEqual([0.75, 1]);
    });
});

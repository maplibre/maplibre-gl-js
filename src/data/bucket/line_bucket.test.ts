import {beforeAll, describe, test, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {SegmentVector} from '../segment';
import {LineBucket} from './line_bucket';
import {LineStyleLayer} from '../../style/style_layer/line_style_layer';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters';
import {type ZoomHistory} from '../../../src/style/zoom_history';
import {type BucketFeature, type BucketParameters} from '../bucket';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile';
import {CanonicalTileID} from '../../tile/tile_id';
import {EXTENT} from '../extent';
import {GEOJSONVT_ANTIMERIDIAN_CLIP} from '@maplibre/geojson-vt';
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
        vi.spyOn(console, 'warn').mockImplementation(() => { });

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

    describe('antimeridian ring splitting', () => {
        const {noSubdivision} = SubdivisionGranularitySetting;

        // Rectangle with one vertical edge on x=0 (the antimeridian on a
        // left-edge tile) and one on x=EXTENT (right-edge).
        const polygonLeft = [new Point(0, 100), new Point(0, 7000), new Point(4000, 7000), new Point(4000, 100)];
        const polygonRight = [new Point(EXTENT, 100), new Point(EXTENT, 7000), new Point(4000, 7000), new Point(4000, 100)];
        const polygonInterior = [new Point(200, 100), new Point(200, 7000), new Point(4000, 7000), new Point(4000, 100)];

        // addFeature gates the antimeridian split on the GEOJSONVT_ANTIMERIDIAN_CLIP tag.
        const polygonFeature = {type: 3, properties: {[GEOJSONVT_ANTIMERIDIAN_CLIP]: true}} as BucketFeature;
        const lineFeature = {type: 2, properties: {[GEOJSONVT_ANTIMERIDIAN_CLIP]: true}} as BucketFeature;

        function render(feature: BucketFeature, ring: Point[], tile: CanonicalTileID) {
            const bucket = createLineBucket({id: 'test'});
            bucket.addFeature(feature, [ring], undefined, tile, undefined, undefined, noSubdivision);
            return {
                vertices: bucket.layoutVertexArray.length,
                indices: bucket.indexArray.length,
            };
        }

        test('polygon ring with an x=0 edge is drawn open on a left-edge tile', () => {
            const interior = render(polygonFeature, polygonLeft, new CanonicalTileID(4, 5, 5));
            const border = render(polygonFeature, polygonLeft, new CanonicalTileID(4, 0, 5));
            expect(border.vertices).toBeLessThan(interior.vertices);
            expect(border.indices).toBeLessThan(interior.indices);
        });

        test('polygon ring with an x=EXTENT edge is drawn open on a right-edge tile', () => {
            const interior = render(polygonFeature, polygonRight, new CanonicalTileID(4, 5, 5));
            const border = render(polygonFeature, polygonRight, new CanonicalTileID(4, 15, 5));
            expect(border.vertices).toBeLessThan(interior.vertices);
            expect(border.indices).toBeLessThan(interior.indices);
        });

        test('polygon ring without an antimeridian edge is unchanged on a border tile', () => {
            const interior = render(polygonFeature, polygonInterior, new CanonicalTileID(4, 5, 5));
            const border = render(polygonFeature, polygonInterior, new CanonicalTileID(4, 0, 5));
            expect(border).toEqual(interior);
        });

        test('LineString feature on a border tile is never split', () => {
            const interior = render(lineFeature, polygonLeft, new CanonicalTileID(4, 5, 5));
            const border = render(lineFeature, polygonLeft, new CanonicalTileID(4, 0, 5));
            expect(border).toEqual(interior);
        });

        test('polygon ring on an interior tile is unchanged regardless of coordinates', () => {
            const a = render(polygonFeature, polygonLeft, new CanonicalTileID(4, 5, 5));
            const b = render(polygonFeature, polygonLeft, new CanonicalTileID(4, 7, 5));
            expect(a).toEqual(b);
        });

        test('does not split untagged feature on a left-edge tile', () => {
            const untaggedPolygon = {type: 3, properties: {}} as BucketFeature;
            const mercator = createLineBucket({id: 'test'});
            mercator.addFeature(untaggedPolygon, [polygonLeft], undefined, new CanonicalTileID(4, 0, 5), undefined, undefined, noSubdivision);
            const interior = render(polygonFeature, polygonLeft, new CanonicalTileID(4, 5, 5));
            expect(mercator.layoutVertexArray.length).toBe(interior.vertices);
            expect(mercator.indexArray.length).toBe(interior.indices);
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
});

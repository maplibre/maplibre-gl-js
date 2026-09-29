import {beforeAll, describe, test, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {SegmentVector} from '../segment.ts';
import {LineBucket} from './line_bucket.ts';
import {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import {serialize, deserialize} from '../../util/web_worker_transfer.ts';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import type {ZoomHistory} from '../../../src/style/zoom_history.ts';
import type {BucketFeature, BucketParameters} from '../bucket.ts';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';
import type {SourceExpressionBinder, ProgramConfigurationSet} from '../program_configuration.ts';

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

    test('setFeatureState re-evaluation keeps original types of JSON-encoded properties', () => {
        const bucket = createLineBucket({
            id: 'test',
            paint: {
                'line-width': ['case',
                    ['boolean', ['feature-state', 'selected'], false], 10,
                    ['in', 7, ['get', 'attributeIds']], 20,
                    1]
            }
        });

        const feature = {
            type: 2,
            properties: {attributeIds: [1, 37]},
            id: 1
        } as BucketFeature;

        bucket.addFeature(feature, [[
            new Point(0, 0),
            new Point(10, 10)
        ]], 0, new CanonicalTileID(0, 0, 0), {}, {}, noSubdivision);

        // After setFeatureState the tile is reloaded from the raw pbf, where the GeoJSON worker
        // source stored the array as a JSON string.
        const vtLayer = {
            feature: () => ({
                type: 2,
                properties: {attributeIds: '__$json__:[1,37]'},
                id: 1,
                extent: 4096,
                loadGeometry: () => []
            })
        } as unknown as VectorTileLayerLike;

        // Buckets cross the worker boundary before update() runs, which indexes the feature map.
        const programConfigurations = deserialize(serialize(bucket.programConfigurations, [])) as ProgramConfigurationSet<LineStyleLayer>;
        programConfigurations.updatePaintArrays([{id: '1', state: {selected: false}}], vtLayer, bucket.layers, {imagePositions: {}, dashPositions: {}});

        const binder = programConfigurations.get('test').binders['line-width'] as SourceExpressionBinder;
        // ["in", 7, [1, 37]] is false for the restored array, but would be true for the raw string.
        expect(new Float32Array(binder.paintVertexArray.arrayBuffer)[0]).toBe(1);
    });
});

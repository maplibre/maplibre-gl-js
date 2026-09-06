import {test, expect, describe, beforeAll, vi} from 'vitest';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile.ts';
import Point from '@mapbox/point-geometry';
import {SegmentVector} from '../segment.ts';
import {FillBucket} from './fill_bucket.ts';
import {FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {type ZoomHistory} from '../../style/zoom_history.ts';
import {type BucketDependencyParameters, type BucketFeature, type BucketParameters} from '../bucket.ts';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';
import type {VectorTileFeatureLike, VectorTileLayerLike} from '@maplibre/vt-pbf';
import type {StyleImage} from '../../style/style_image.ts';

function createPolygon(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(new Point(2048 + 256 * Math.cos(i / numPoints * 2 * Math.PI), 2048 + 256 * Math.sin(i / numPoints * 2 * Math.PI)));
    }
    return points;
}

function createFillBucket({id, layout, paint, globalState, availableImages}: CreateBucketParameters): FillBucket {
    return createFillBucketWithLayers([{id, type: 'fill', layout, paint} as LayerSpecification], availableImages, globalState);
}

function createFillBucketWithLayers(layerSpecifications: LayerSpecification[], availableImages: string[] = [], globalState?: Record<string, unknown>): FillBucket {
    const layers = layerSpecifications.map((layerSpecification) => {
        const layer = new FillStyleLayer(layerSpecification, globalState);
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, availableImages);
        return layer;
    });

    return new FillBucket({layers, zoom: 0, overscaling: 0, index: 0} as BucketParameters<FillStyleLayer>);
}

function createDependencyParameters(imageMap: Record<string, StyleImage>): BucketDependencyParameters {
    return {
        options: createPopulateOptions(Object.keys(imageMap)),
        canonical: new CanonicalTileID(0, 0, 0),
        imagePositions: {},
        dashPositions: {},
        imageMap
    };
}

function createPatternFeature(a: string, b: string): VectorTileFeatureLike {
    return {
        type: 3,
        properties: {a, b},
        id: 0,
        extent: 4096,
        loadGeometry: () => [[
            new Point(0, 0),
            new Point(16, 0),
            new Point(16, 16),
            new Point(0, 16)
        ]]
    };
}

describe('FillBucket', () => {
    let sourceLayer: VectorTileLayerLike;
    let canonicalTileID;
    beforeAll(() => {
        // Load fill features from fixture tile.
        sourceLayer = loadVectorTile().layers.water;
        canonicalTileID = new CanonicalTileID(20, 1, 1);
    });

    test('FillBucket', () => {
        expect(() => {
            const bucket = createFillBucket({id: 'test', layout: {}});

            bucket.addFeature({} as BucketFeature, [[
                new Point(0, 0),
                new Point(10, 10)
            ]], undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);

            bucket.addFeature({} as BucketFeature, [[
                new Point(0, 0),
                new Point(10, 10),
                new Point(10, 20)
            ]], undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);

            const feature = sourceLayer.feature(0);
            bucket.addFeature(feature as any, feature.loadGeometry(), undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);
        }).not.toThrow();
    });

    test('FillBucket segmentation', () => {
        // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
        // breaking across array groups without tests taking a _long_ time.
        Object.defineProperty(SegmentVector, 'MAX_VERTEX_ARRAY_LENGTH', {value: 256});

        const bucket = createFillBucket({id: 'test', layout: {}, paint: {
            'fill-color': ['to-color', ['get', 'foo'], '#000']
        }});

        // first add an initial, small feature to make sure the next one starts at
        // a non-zero offset
        bucket.addFeature({} as BucketFeature, [createPolygon(10)], undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);

        // add a feature that will break across the group boundary
        bucket.addFeature({} as BucketFeature, [
            createPolygon(128),
            createPolygon(128)
        ], undefined, canonicalTileID, undefined, SubdivisionGranularitySetting.noSubdivision);

        // Each polygon must fit entirely within a segment, so we expect the
        // first segment to include the first feature and the first polygon
        // of the second feature, and the second segment to include the
        // second polygon of the second feature.
        expect(bucket.layoutVertexArray).toHaveLength(266);
        expect(bucket.segments.get()[0]).toEqual({
            vertexOffset: 0,
            vertexLength: 138,
            vaos: {},
            primitiveOffset: 0,
            primitiveLength: 134
        });
        expect(bucket.segments.get()[1]).toEqual({
            vertexOffset: 138,
            vertexLength: 128,
            vaos: {},
            primitiveOffset: 134,
            primitiveLength: 126
        });

    });

    test('FillBucket fill-pattern with global-state', () => {
        const availableImages = [];
        const bucket = createFillBucket({id: 'test', paint: {
            'fill-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']]
        }, globalState: {pattern: 'test-pattern'}, availableImages});

        bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions(availableImages), undefined);

        expect(bucket.patternFeatures.length).toBeGreaterThan(0);
        expect(bucket.patternFeatures[0].patterns).toEqual({
            test: {min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern'}
        });
    });

    test('tracks constant SDF fill patterns per layer', () => {
        const availableImages = ['sdf-pattern', 'rgba-pattern'];
        const bucket = createFillBucketWithLayers([
            {id: 'sdf-layer', type: 'fill', paint: {'fill-pattern': 'sdf-pattern'}},
            {id: 'rgba-layer', type: 'fill', paint: {'fill-pattern': 'rgba-pattern'}}
        ] as LayerSpecification[], availableImages);
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

        bucket.addFeatures(createDependencyParameters({
            'sdf-pattern': {sdf: true} as StyleImage,
            'rgba-pattern': {sdf: false} as StyleImage
        }));

        expect(bucket.sdfPatterns).toEqual({
            'sdf-layer': true,
            'rgba-layer': false
        });
        expect(warning).not.toHaveBeenCalled();
        warning.mockRestore();
    });

    test('warns for mixed data-driven SDF and non-SDF fill patterns in one layer', () => {
        const availableImages = ['sdf-pattern', 'rgba-pattern'];
        const bucket = createFillBucket({
            id: 'mixed-data-driven-layer',
            paint: {'fill-pattern': ['step', ['zoom'], ['get', 'a'], 0.5, ['get', 'b']]},
            availableImages
        });
        bucket.populate([{feature: createPatternFeature('sdf-pattern', 'rgba-pattern'), id: 0, index: 0, sourceLayerIndex: 0}], createPopulateOptions(availableImages), undefined);
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

        bucket.addFeatures(createDependencyParameters({
            'sdf-pattern': {sdf: true} as StyleImage,
            'rgba-pattern': {sdf: false} as StyleImage
        }));

        expect(bucket.sdfPatterns['mixed-data-driven-layer']).toBe(true);
        expect(warning).toHaveBeenCalled();
        warning.mockRestore();
    });

    test('warns when a constant pattern crossfade mixes SDF and non-SDF images', () => {
        const availableImages = ['sdf-pattern', 'rgba-pattern'];
        const bucket = createFillBucket({
            id: 'mixed-crossfade-layer',
            paint: {'fill-pattern': ['step', ['zoom'], 'rgba-pattern', 1, 'sdf-pattern']},
            availableImages
        });
        bucket.layers[0].recalculate({zoom: 0.5, zoomHistory: {} as ZoomHistory} as EvaluationParameters, availableImages);
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

        bucket.addFeatures(createDependencyParameters({
            'sdf-pattern': {sdf: true} as StyleImage,
            'rgba-pattern': {sdf: false} as StyleImage
        }));

        expect(bucket.sdfPatterns['mixed-crossfade-layer']).toBe(true);
        expect(warning).toHaveBeenCalled();
        warning.mockRestore();
    });
});

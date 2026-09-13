import {beforeAll, describe, test, expect} from 'vitest';
import {FillExtrusionBucket} from './fill_extrusion_bucket.ts';
import {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {type ZoomHistory} from '../../style/zoom_history.ts';
import {type BucketParameters} from '../bucket.ts';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile.ts';
import {type VectorTileLayerLike} from '@maplibre/vt-pbf';
import {roundPolygonCorners} from './round_polygon_corners.ts';
import {loadGeometry} from '../load_geometry.ts';
import {type CanonicalTileID} from '../../tile/tile_id.ts';
import type Point from '@mapbox/point-geometry';

function countPoints(geometries: Point[][][]): number {
    return geometries.reduce((total, rings) => total + rings.reduce((sum, ring) => sum + ring.length, 0), 0);
}

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

    test('FillExtrusionBucket rounds each feature\'s corners once', () => {
        const canonical = {x: 0, y: 0, z: 14} as any as CanonicalTileID;
        const distance = 10;
        const features = getFeaturesFromLayer(sourceLayer);
        const populateOptions = createPopulateOptions([]);

        const roundedOnce = features.map(({feature}) => roundPolygonCorners(loadGeometry(feature), distance, canonical));
        const roundedTwice = roundedOnce.map((geometry) => roundPolygonCorners(geometry, distance, canonical));
        expect(countPoints(roundedTwice)).toBeGreaterThan(countPoints(roundedOnce));

        const bucket = createFillExtrusionBucket({
            id: 'test-rounding-once',
            layout: {'fill-extrusion-rounded-corner-distance': distance},
            paint: {'fill-extrusion-height': 10}
        });
        bucket.populate(features, populateOptions, canonical);

        const expected = createFillExtrusionBucket({
            id: 'test-rounding-expected',
            layout: {'fill-extrusion-rounded-corner-distance': 0},
            paint: {'fill-extrusion-height': 10}
        });
        for (const [index, geometry] of roundedOnce.entries()) {
            const {feature} = features[index];
            expected.addFeature(
                {id: index, sourceLayerIndex: 0, index, geometry, properties: feature.properties, type: feature.type, patterns: {}},
                geometry, index, canonical, {}, populateOptions.subdivisionGranularity);
        }

        expect(bucket.layoutVertexArray).toHaveLength(expected.layoutVertexArray.length);
        expect(bucket.indexArray).toHaveLength(expected.indexArray.length);
    });
});

import {FillExtrusionBucket} from './fill_extrusion_bucket';
import {IndexedFeature, PopulateParameters} from '../bucket';
import {CanonicalTileID} from '../../source/tile_id';
import Point from '@mapbox/point-geometry';
import {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import {mock} from 'jest-mock-extended';
import {PossiblyEvaluated} from '../../style/properties';
import {
    FillExtrusionPaintProps,
    FillExtrusionPaintPropsPossiblyEvaluated,
    default as FillExtrusionStyleLayerProperties
} from '../../style/style_layer/fill_extrusion_style_layer_properties.g';
import {FeatureIndex} from '../feature_index';

const poly1: IndexedFeature = {
    feature: {
        extent: 8192,
        id: 1,
        properties: {},
        type: 3, // polygon
        loadGeometry(): Point[][] {
            return [[new Point(0, 0), new Point(0, 10), new Point(10, 10), new Point(10, 0), new Point(0, 0)]];
        },
        bbox(): [number, number, number, number] {
            throw new Error('not implemented');
            // return [0, 0, 1, 1];
        },
        toGeoJSON() {
            throw new Error('not implemented');
        }
    },
    id: '1',
    index: 0,
    sourceLayerIndex: 0,
};

const poly2: IndexedFeature = {
    feature: {
        extent: 8192,
        id: 2,
        properties: {},
        type: 3, // polygon
        loadGeometry(): Point[][] {
            return [[new Point(2, 2), new Point(2, 3), new Point(3, 3), new Point(3, 2), new Point(2, 2)]];
        },
        bbox(): [number, number, number, number] {
            throw new Error('not implemented');
        },
        toGeoJSON() {
            throw new Error('not implemented');
        }
    },
    id: '2',
    index: 0,
    sourceLayerIndex: 0,
};

describe('FillExtrusionBucket', () => {
    let paint: PossiblyEvaluated<FillExtrusionPaintProps, FillExtrusionPaintPropsPossiblyEvaluated>;
    let layer: FillExtrusionStyleLayer;
    let bucket: FillExtrusionBucket;
    beforeEach(() => {
        paint = new PossiblyEvaluated<FillExtrusionPaintProps, FillExtrusionPaintPropsPossiblyEvaluated>(FillExtrusionStyleLayerProperties.paint);
        layer = mock<FillExtrusionStyleLayer>({
            paint,
            _featureFilter: {
                filter: () => true,
                needGeometry: false
            }
        });
        bucket = new FillExtrusionBucket({
            collisionBoxArray: undefined,
            pixelRatio: 0,
            sourceID: '',
            sourceLayerIndex: 0,
            zoom: 14,
            overscaling: 1,
            layers: [layer],
            index: 0
        });
    });

    it('should populate a centroid location per polygon feature', () => {
        const features: IndexedFeature[] = [poly1, poly2];
        const populateParameters = mock<PopulateParameters>();
        populateParameters.patternDependencies = {};
        const featureIndex = mock<FeatureIndex>();
        populateParameters.featureIndex = featureIndex;
        bucket.populate(features, populateParameters, {} as CanonicalTileID);
        expect(featureIndex.insert).toHaveBeenNthCalledWith(1, poly1.feature, poly1.feature.loadGeometry(), 0, 0, 0, true);
        expect(featureIndex.insert).toHaveBeenNthCalledWith(2, poly2.feature, poly2.feature.loadGeometry(), 0, 0, 0, true);
        const centroidVertexArray = bucket.centroidVertexArray;
        for (let i = 0; i < 42; i++) {
            expect(centroidVertexArray.int16[i]).toBe(4);
        }
        for (let i = 42; i < 84; i++) {
            expect(centroidVertexArray.int16[i]).toBe(2);
        }
        // Add more assertions as needed
    });

});


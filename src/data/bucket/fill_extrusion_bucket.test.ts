import {beforeAll, describe, test, expect} from 'vitest';
import {FillExtrusionBucket} from './fill_extrusion_bucket.ts';
import {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {type ZoomHistory} from '../../style/zoom_history.ts';
import {type BucketParameters} from '../bucket.ts';
import {type CreateBucketParameters, createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../../test/unit/lib/tile.ts';
import {type VectorTileLayerLike} from '@maplibre/vt-pbf';

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
});

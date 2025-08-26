import {test, expect} from 'vitest';
import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {FillExtrusionBucket} from './fill_extrusion_bucket';
import {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters';
import {type BucketParameters, type IndexedFeature, type PopulateParameters} from '../bucket';
import {OverscaledTileID} from '../../source/tile_id';
import {FeatureIndex} from '../feature_index';

// Load a fill feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.resolve(__dirname, '../../../test/unit/assets/mbsv5-6-18-23.vector.pbf'))));

test('FillExtrusionBucket fill-pattern with global-state', () => {
    const availableImages = [];
    const globalState = {pattern: 'test-pattern'} as Record<string, any>;
    const layer = new FillExtrusionStyleLayer({
        id: 'test',
        type: 'fill-extrusion',
        source: 'test-source',
        paint: {'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']]}
    } as LayerSpecification);
    layer.recalculate({zoom: 0, globalState} as EvaluationParameters, availableImages);

    const bucket = new FillExtrusionBucket({layers: [layer], globalState} as BucketParameters<FillExtrusionStyleLayer>);

    const sourceLayer = vt.layers.water;
    const features = new Array<IndexedFeature>(sourceLayer.length);
    for (let i = 0; i < sourceLayer.length; i++) {
        features[i] = {feature: sourceLayer.feature(i), index: 0} as IndexedFeature;
    }

    bucket.populate(features, {
        patternDependencies: {},
        featureIndex: new FeatureIndex(new OverscaledTileID(0, 0, 0, 0, 0)),
        availableImages,
    } as PopulateParameters, undefined);

    expect(bucket.features.length).toBeGreaterThan(0);
    expect(bucket.features[0].patterns).toEqual({
        test: {min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern'}
    });
});

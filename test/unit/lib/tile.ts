import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {OverscaledTileID} from '../../../src/tile/tile_id';
import {FeatureIndex} from '../../../src/data/feature_index';
import type {IndexedFeature, PopulateParameters} from '../../../src/data/bucket';
import {SubdivisionGranularitySetting} from '../../../src/render/subdivision_granularity_settings';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

export type CreateBucketParameters = {
    id: string;
    layout?: Record<string, any>;
    paint?: Record<string, any>;
    globalState?: Record<string, any>;
    availableImages?: Array<string>;
};

export function loadVectorTile(name = 'mbsv5-6-18-23.vector.pbf'): VectorTile {
    const vt = new VectorTile(new Protobuf(fs.readFileSync(path.resolve(__dirname, '../../../test/unit/assets', name))));
    return vt;
}

export function getFeaturesFromLayer(sourceLayer: VectorTileLayerLike): Array<IndexedFeature> {
    const features = new Array<IndexedFeature>(sourceLayer.length);
    for (let i = 0; i < sourceLayer.length; i++) {
        features[i] = {feature: sourceLayer.feature(i), index: i} as unknown as IndexedFeature;
    }
    return features;
}

export function createPopulateOptions(availableImages): PopulateParameters {
    return {
        featureIndex: new FeatureIndex(new OverscaledTileID(0, 0, 0, 0, 0)),
        iconDependencies: {},
        patternDependencies: {},
        glyphDependencies: {},
        dashDependencies: {},
        availableImages,
        subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
    };
}

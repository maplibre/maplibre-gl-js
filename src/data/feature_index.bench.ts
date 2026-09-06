import {bench} from 'vitest';
import {FeatureIndex} from './feature_index.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';

import type {FeatureFilter} from '@maplibre/maplibre-gl-style-spec';
import type {VectorTileFeatureLike, VectorTileLayerLike} from '@maplibre/vt-pbf';

const layerCount = 100;
const filter = {needGeometry: false} as FeatureFilter;

const featureIndex = new FeatureIndex(new OverscaledTileID(0, 0, 0, 0, 0));
featureIndex.bucketLayerIDs = [Array.from({length: layerCount}, (_, i) => `layer-${i}`)];
featureIndex.vtLayers = {
    '0': {feature: () => ({} as VectorTileFeatureLike)} as unknown as VectorTileLayerLike
};

const layerIdsToTest = new Set(Array.from({length: layerCount}, (_, i) => `non-existing-layer-${i}`));

bench('FeatureIndex.loadMatchingFeature', () => {
    featureIndex.loadMatchingFeature({}, 0, 0, 0, filter, layerIdsToTest, [], {}, {});
});

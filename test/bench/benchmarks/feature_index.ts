import {OverscaledTileID} from '../../../src/source/tile_id';
import Benchmark from '../lib/benchmark';
import {FeatureIndex} from '../../../src/data/feature_index';
import {VectorTileFeature, VectorTileLayer} from '@mapbox/vector-tile';
import {FeatureFilter} from '@maplibre/maplibre-gl-style-spec';

export default class LoadMatchingFeature extends Benchmark {
    featureIndex: FeatureIndex;
    layerIdsToTest: Set<string>;

    async setup(): Promise<void> {
        await super.setup();

        const numLayersToAdd = 100;

        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        this.featureIndex = new FeatureIndex(tileID);

        // Setup the featureIndex with fake data so we can test it
        const layerIds = Array.from({length: numLayersToAdd}, (_, i) => `layer-${i}`);
        // Worst case scenario happens when there's no intersection between layerIds in the feature index and the filterLayerIds
        // so we create new ones
        this.layerIdsToTest = new Set(Array.from({length: numLayersToAdd}, (_, i) => `non-existing-layer-${i}`));
        this.featureIndex.bucketLayerIDs = [layerIds];
        this.featureIndex.vtLayers = {};
        this.featureIndex.vtLayers['0'] = {
            feature: () => ({} as VectorTileFeature)
        } as unknown as VectorTileLayer;
    }

    bench() {
        this.featureIndex.loadMatchingFeature({}, 0, 0, 0, {needGeometry: false} as FeatureFilter, this.layerIdsToTest, [], {}, {});
    }
}

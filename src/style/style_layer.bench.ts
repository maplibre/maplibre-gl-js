import {bench, describe} from 'vitest';
import {readFileSync} from 'fs';
import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import {featureFilter} from '@maplibre/maplibre-gl-style-spec';
import filters from '../../test/bench/data/filters.json' with {type: 'json'};

import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {FeatureFilter, FilterSpecification} from '@maplibre/maplibre-gl-style-spec';

type FilteredLayer = {
    features: VectorTileFeature[];
    filters: FeatureFilter[];
};

function readLayers(): FilteredLayer[] {
    const data = readFileSync(new URL('../../test/bench/data/785.vector.pbf', import.meta.url));
    const tile = new VectorTile(new PbfReader(new Uint8Array(data)));
    const layers: FilteredLayer[] = [];

    for (const name in tile.layers) {
        const layer = tile.layers[name];
        if (!layer.length) {
            continue;
        }

        const features = [];
        for (let i = 0; i < layer.length; i++) {
            features.push(layer.feature(i));
        }

        const layerFilters = [];
        for (const filter of filters) {
            if (filter.layer === name) {
                layerFilters.push(featureFilter(filter.filter as FilterSpecification, 'filter'));
            }
        }

        layers.push({features, filters: layerFilters});
    }

    return layers;
}

const layers = readLayers();

describe('featureFilter', () => {
    bench('create', () => {
        for (const filter of filters) {
            featureFilter(filter.filter as FilterSpecification, 'filter');
        }
    });

    bench('evaluate', () => {
        for (const layer of layers) {
            for (const filter of layer.filters) {
                for (const feature of layer.features) {
                    if (typeof filter.filter({zoom: 0}, feature) !== 'boolean') {
                        throw new Error('Expected boolean result from filter');
                    }
                }
            }
        }
    });
});

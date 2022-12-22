
import Benchmark from '../lib/benchmark';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
import createFilter from '../../../src/style-spec/feature_filter';
import filters from '../data/filters.json' assert {type: 'json'};

export default class FilterEvaluate extends Benchmark {
    layers: any[];

    async setup() {
        const response = await fetch('/bench/data/785.vector.pbf');
        const data = await response.arrayBuffer();
        const tile = new VectorTile(new Pbf(data));

        this.layers = [];
        for (const name in tile.layers) {
            const layer = tile.layers[name];
            if (!layer.length)
                continue;

            const features = [];
            for (let j = 0; j < layer.length; j++) {
                features.push(layer.feature(j));
            }

            const layerFilters = [];
            for (const filter of filters) {
                if (filter.layer === name) {
                    layerFilters.push(createFilter(filter.filter));
                }
            }

            this.layers.push({features, filters: layerFilters});
        }
    }

    bench() {
        for (const layer of this.layers) {
            for (const filter of layer.filters) {
                for (const feature of layer.features) {
                    if (typeof filter.filter({zoom: 0}, feature) !== 'boolean') {
                        throw new Error('Expected boolean result from filter');
                    }
                }
            }
        }
    }
}

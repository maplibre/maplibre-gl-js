import Benchmark from '../lib/benchmark';

import {featureFilter as createFilter} from '@maplibre/maplibre-gl-style-spec';
import filters from '../data/filters.json' with {type: 'json'};

export default class FilterCreate extends Benchmark {
    bench() {
        for (const filter of filters) {
            createFilter(filter.filter);
        }
    }
}

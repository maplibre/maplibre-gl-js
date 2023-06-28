import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import Benchmark from '../lib/benchmark';
import {createStyleLayer} from '../../../src/style/create_style_layer';
import {derefLayers as deref} from '@maplibre/maplibre-gl-style-spec';
import fetchStyle from '../lib/fetch_style';

export default class StyleLayerCreate extends Benchmark {
    style: string | StyleSpecification;
    layers: Array<any>;

    constructor(style: string | StyleSpecification) {
        super();
        this.style = style;
    }

    async setup() {
        const json = await fetchStyle(this.style);
        this.layers = deref(json.layers);
    }

    bench() {
        for (const layer of this.layers) {
            createStyleLayer(layer);
        }
    }
}

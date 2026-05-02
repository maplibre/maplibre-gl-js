import {derefLayers, type StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import Benchmark from '../lib/benchmark.ts';
import {createStyleLayer} from '../../../src/style/create_style_layer.ts';
import fetchStyle from '../lib/fetch_style.ts';

export default class StyleLayerCreate extends Benchmark {
    style: string | StyleSpecification;
    layers: any[];

    constructor(style: string | StyleSpecification) {
        super();
        this.style = style;
    }

    async setup() {
        const json = await fetchStyle(this.style);
        this.layers = derefLayers(json.layers);
    }

    bench() {
        for (const layer of this.layers) {
            createStyleLayer(layer, {});
        }
    }
}

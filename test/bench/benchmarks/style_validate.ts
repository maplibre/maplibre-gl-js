import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import Benchmark from '../lib/benchmark';
import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';
import fetchStyle from '../lib/fetch_style';

export default class StyleValidate extends Benchmark {
    style: string | StyleSpecification;
    json: StyleSpecification;

    constructor(style: string) {
        super();
        this.style = style;
    }

    async setup(): Promise<void> {
        this.json = await fetchStyle(this.style);
    }

    bench(): void {
        validateStyleMin(this.json);
    }
}

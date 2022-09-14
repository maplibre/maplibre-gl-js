import type {StyleSpecification} from '../../../src/style-spec/types.g';
import Benchmark from '../lib/benchmark';
import validateStyle from '../../../src/style-spec/validate_style.min';
import fetchStyle from '../lib/fetch_style';

export default class StyleValidate extends Benchmark {
    style: string | StyleSpecification;
    json: StyleSpecification;

    constructor(style: string) {
        super();
        this.style = style;
    }

    async setup() {
        this.json = await fetchStyle(this.style);
    }

    bench() {
        validateStyle(this.json);
    }
}

import type {StencilOpConstant, StencilTestGL} from './types';

const ALWAYS = 0x0207;
const KEEP = 0x1E00;

export class StencilMode {
    test: StencilTestGL;
    ref: number;
    mask: number;
    fail: StencilOpConstant;
    depthFail: StencilOpConstant;
    pass: StencilOpConstant;

    constructor(test: StencilTestGL, ref: number, mask: number, fail: StencilOpConstant,
        depthFail: StencilOpConstant, pass: StencilOpConstant) {
        this.test = test;
        this.ref = ref;
        this.mask = mask;
        this.fail = fail;
        this.depthFail = depthFail;
        this.pass = pass;
    }

    static disabled: Readonly<StencilMode>;
}

StencilMode.disabled = new StencilMode({func: ALWAYS, mask: 0}, 0, 0, KEEP, KEEP, KEEP);

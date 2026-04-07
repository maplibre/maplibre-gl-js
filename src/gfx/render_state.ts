import type {DepthMode} from '../gl/depth_mode';
import type {StencilMode} from '../gl/stencil_mode';
import type {ColorMode} from '../gl/color_mode';
import type {CullFaceMode} from '../gl/cull_face_mode';

// GL constants
const GL_NEVER    = 0x0200;
const GL_LESS     = 0x0201;
const GL_EQUAL    = 0x0202;
const GL_LEQUAL   = 0x0203;
const GL_GREATER  = 0x0204;
const GL_NOTEQUAL = 0x0205;
const GL_GEQUAL   = 0x0206;
const GL_ALWAYS   = 0x0207;

const GL_KEEP    = 0x1E00;
const GL_ZERO    = 0x0000;
const GL_REPLACE = 0x1E01;
const GL_INCR    = 0x1E02;
const GL_DECR    = 0x1E03;
const GL_INVERT  = 0x150A;
const GL_INCR_WRAP = 0x8507;
const GL_DECR_WRAP = 0x8508;

const GL_ONE = 0x0001;
const GL_SRC_ALPHA = 0x0302;
const GL_ONE_MINUS_SRC_ALPHA = 0x0303;
const GL_DST_ALPHA = 0x0304;
const GL_ONE_MINUS_DST_ALPHA = 0x0305;
const GL_DST_COLOR = 0x0306;
const GL_SRC_COLOR = 0x0300;
const GL_CONSTANT_COLOR = 0x8001;

const GL_FRONT = 0x0404;
const GL_BACK  = 0x0405;

type CompareFunction = 'never' | 'less' | 'equal' | 'less-equal' | 'greater' | 'not-equal' | 'greater-equal' | 'always';
type StencilOperation = 'keep' | 'zero' | 'replace' | 'invert' | 'increment-clamp' | 'decrement-clamp' | 'increment-wrap' | 'decrement-wrap';
type BlendFactor = 'zero' | 'one' | 'src' | 'one-minus-src' | 'src-alpha' | 'one-minus-src-alpha' | 'dst' | 'one-minus-dst' | 'dst-alpha' | 'one-minus-dst-alpha' | 'constant';

export interface RenderPipelineParameters {
    depthWriteEnabled: boolean;
    depthCompare: CompareFunction;
    stencilReadMask: number;
    stencilWriteMask: number;
    stencilCompare: CompareFunction;
    stencilPassOperation: StencilOperation;
    stencilFailOperation: StencilOperation;
    stencilDepthFailOperation: StencilOperation;
    blend: boolean;
    blendColorSrcFactor: BlendFactor;
    blendColorDstFactor: BlendFactor;
    blendAlphaSrcFactor: BlendFactor;
    blendAlphaDstFactor: BlendFactor;
    colorWriteMask: number;
    cullMode: 'none' | 'front' | 'back';
    frontFace: 'ccw' | 'cw';
}

function glCompareFuncToWebGPU(func: number): CompareFunction {
    switch (func) {
        case GL_NEVER: return 'never';
        case GL_LESS: return 'less';
        case GL_EQUAL: return 'equal';
        case GL_LEQUAL: return 'less-equal';
        case GL_GREATER: return 'greater';
        case GL_NOTEQUAL: return 'not-equal';
        case GL_GEQUAL: return 'greater-equal';
        case GL_ALWAYS: return 'always';
        default: return 'always';
    }
}

function glStencilOpToWebGPU(op: number): StencilOperation {
    switch (op) {
        case GL_KEEP: return 'keep';
        case GL_ZERO: return 'zero';
        case GL_REPLACE: return 'replace';
        case GL_INVERT: return 'invert';
        case GL_INCR: return 'increment-clamp';
        case GL_DECR: return 'decrement-clamp';
        case GL_INCR_WRAP: return 'increment-wrap';
        case GL_DECR_WRAP: return 'decrement-wrap';
        default: return 'keep';
    }
}

function glBlendFactorToWebGPU(factor: number): BlendFactor {
    switch (factor) {
        case GL_ZERO: return 'zero';
        case GL_ONE: return 'one';
        case GL_SRC_COLOR: return 'src';
        case GL_SRC_ALPHA: return 'src-alpha';
        case GL_ONE_MINUS_SRC_ALPHA: return 'one-minus-src-alpha';
        case GL_DST_COLOR: return 'dst';
        case GL_DST_ALPHA: return 'dst-alpha';
        case GL_ONE_MINUS_DST_ALPHA: return 'one-minus-dst-alpha';
        case GL_CONSTANT_COLOR: return 'constant';
        default: return 'one';
    }
}

/**
 * Convert GL-style render state to pipeline parameters.
 */
export function renderStateToLumaParameters(
    depthMode: Readonly<DepthMode>,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    cullFaceMode: Readonly<CullFaceMode>
): RenderPipelineParameters {
    // Depth
    const depthDisabled = depthMode.func === GL_ALWAYS && !depthMode.mask;
    const depthCompare: CompareFunction = depthDisabled ? 'always' : glCompareFuncToWebGPU(depthMode.func);
    const depthWriteEnabled = depthMode.mask;

    // Stencil
    const stencilDisabled = stencilMode.test.func === GL_ALWAYS && stencilMode.test.mask === 0;
    const stencilCompare: CompareFunction = stencilDisabled ? 'always' : glCompareFuncToWebGPU(stencilMode.test.func);
    const stencilReadMask = stencilMode.test.mask;
    const stencilWriteMask = stencilMode.mask;
    const stencilPassOperation = glStencilOpToWebGPU(stencilMode.pass);
    const stencilFailOperation = glStencilOpToWebGPU(stencilMode.fail);
    const stencilDepthFailOperation = glStencilOpToWebGPU(stencilMode.depthFail);

    // Blend
    const [srcFactor, dstFactor] = colorMode.blendFunction;
    const blend = !(srcFactor === GL_ONE && dstFactor === GL_ZERO);
    const blendColorSrcFactor = glBlendFactorToWebGPU(srcFactor);
    const blendColorDstFactor = glBlendFactorToWebGPU(dstFactor);

    // Color mask: 4 bools → bitmask (R=1, G=2, B=4, A=8)
    const [r, g, b, a] = colorMode.mask;
    const colorWriteMask = (r ? 1 : 0) | (g ? 2 : 0) | (b ? 4 : 0) | (a ? 8 : 0);

    // Cull face
    let cullMode: 'none' | 'front' | 'back' = 'none';
    if (cullFaceMode.enable) {
        cullMode = cullFaceMode.mode === GL_FRONT ? 'front' : 'back';
    }

    return {
        depthWriteEnabled,
        depthCompare,
        stencilReadMask,
        stencilWriteMask,
        stencilCompare,
        stencilPassOperation,
        stencilFailOperation,
        stencilDepthFailOperation,
        blend,
        blendColorSrcFactor,
        blendColorDstFactor,
        blendAlphaSrcFactor: blendColorSrcFactor,
        blendAlphaDstFactor: blendColorDstFactor,
        colorWriteMask,
        cullMode,
        frontFace: 'ccw',
    };
}

/**
 * Compute a hash string from render state, used as a cache key for pipeline objects.
 */
export function renderStateHash(
    depthMode: Readonly<DepthMode>,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    cullFaceMode: Readonly<CullFaceMode>
): string {
    const d = `${depthMode.func}:${depthMode.mask ? 1 : 0}`;
    const s = `${stencilMode.test.func}:${stencilMode.test.mask}:${stencilMode.mask}:${stencilMode.fail}:${stencilMode.depthFail}:${stencilMode.pass}`;
    const [sf, df] = colorMode.blendFunction;
    const [r, g, b, a] = colorMode.mask;
    const c = `${sf}:${df}:${r ? 1 : 0}${g ? 1 : 0}${b ? 1 : 0}${a ? 1 : 0}`;
    const f = `${cullFaceMode.enable ? 1 : 0}:${cullFaceMode.mode}`;
    return `${d}|${s}|${c}|${f}`;
}

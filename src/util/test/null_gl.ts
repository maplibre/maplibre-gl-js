import {vi} from 'vitest';

/**
 * WebGL2-specific constants
 */
const webgl2Enums = {
    PIXEL_PACK_BUFFER: 0x88EB,
    PIXEL_UNPACK_BUFFER: 0x88EC,
    PIXEL_PACK_BUFFER_BINDING: 0x88ED,
    PIXEL_UNPACK_BUFFER_BINDING: 0x88EF,
    STREAM_READ: 0x88E1,
    STREAM_COPY: 0x88E2,
    STATIC_READ: 0x88E5,
    STATIC_COPY: 0x88E6,
    DYNAMIC_READ: 0x88E9,
    DYNAMIC_COPY: 0x88EA,
    HALF_FLOAT: 0x140B,
    RGB16F: 0x881B,
    RGBA16F: 0x881A,
    RGB32F: 0x8815,
    RGBA32F: 0x8814,
    R16F: 0x822D,
    RG16F: 0x822F,
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
    ALREADY_SIGNALED: 0x911A,
    TIMEOUT_EXPIRED: 0x911B,
    CONDITION_SATISFIED: 0x911C,
    WAIT_FAILED: 0x911D,
    SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
    READ_BUFFER: 0x0C02,
};

/**
 * WebGL1 constants
 */
const webgl1Enums = {
    VERSION: 0x1F02,
    MAX_TEXTURE_SIZE: 0x0D33,
    COLOR_ATTACHMENT0: 0x8CE0,
    FRAMEBUFFER: 0x8D40,
    RENDERBUFFER: 0x8D41,
    FRAMEBUFFER_COMPLETE: 0x8CD5,
    DEPTH_BUFFER_BIT: 0x00000100,
    STENCIL_BUFFER_BIT: 0x00000400,
    COLOR_BUFFER_BIT: 0x00004000,
    POINTS: 0,
    LINES: 1,
    LINE_LOOP: 2,
    LINE_STRIP: 3,
    TRIANGLES: 4,
    TRIANGLE_STRIP: 5,
    TRIANGLE_FAN: 6,
    ZERO: 0,
    ONE: 1,
    SRC_COLOR: 0x0300,
    ONE_MINUS_SRC_COLOR: 0x0301,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    DST_ALPHA: 0x0304,
    ONE_MINUS_DST_ALPHA: 0x0305,
    DST_COLOR: 0x0306,
    ONE_MINUS_DST_COLOR: 0x0307,
    CONSTANT_COLOR: 0x8001,
    FUNC_ADD: 0x8006,
    BLEND: 0x0BE2,
    DEPTH_TEST: 0x0B71,
    STENCIL_TEST: 0x0B90,
    CULL_FACE: 0x0B44,
    SCISSOR_TEST: 0x0C11,
    FRONT: 0x0404,
    BACK: 0x0405,
    CW: 0x0900,
    CCW: 0x0901,
    NEVER: 0x0200,
    LESS: 0x0201,
    EQUAL: 0x0202,
    LEQUAL: 0x0203,
    GREATER: 0x0204,
    NOTEQUAL: 0x0205,
    GEQUAL: 0x0206,
    ALWAYS: 0x0207,
    KEEP: 0x1E00,
    REPLACE: 0x1E01,
    INCR: 0x1E02,
    DECR: 0x1E03,
    BYTE: 0x1400,
    UNSIGNED_BYTE: 0x1401,
    SHORT: 0x1402,
    UNSIGNED_SHORT: 0x1403,
    INT: 0x1404,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
    ALPHA: 0x1906,
    RGB: 0x1907,
    RGBA: 0x1908,
    DEPTH_COMPONENT: 0x1902,
    DEPTH_COMPONENT16: 0x81A5,
    DEPTH_STENCIL: 0x84F9,
    DEPTH_STENCIL_ATTACHMENT: 0x821A,
    DEPTH_ATTACHMENT: 0x8D00,
    TEXTURE_2D: 0x0DE1,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    NEAREST: 0x2600,
    LINEAR_MIPMAP_NEAREST: 0x2701,
    NEAREST_MIPMAP_LINEAR: 0x2702,
    REPEAT: 0x2901,
    CLAMP_TO_EDGE: 0x812F,
    TEXTURE0: 0x84C0,
    TEXTURE1: 0x84C1,
    TEXTURE2: 0x84C2,
    TEXTURE3: 0x84C3,
    TEXTURE4: 0x84C4,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88E4,
    DYNAMIC_DRAW: 0x88E8,
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    UNPACK_ALIGNMENT: 0x0CF5,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    MAX_TEXTURE_IMAGE_UNITS: 0x8872,
};

const allEnums = {...webgl1Enums, ...webgl2Enums};

/** All WebGL1 method names that return a generic stub value */
const webgl1Methods = [
    'activeTexture', 'attachShader', 'bindAttribLocation', 'bindBuffer',
    'bindFramebuffer', 'bindRenderbuffer', 'bindTexture', 'blendColor',
    'blendEquation', 'blendEquationSeparate', 'blendFunc', 'blendFuncSeparate',
    'bufferData', 'bufferSubData', 'clear', 'clearColor', 'clearDepth',
    'clearStencil', 'colorMask', 'compileShader', 'copyTexImage2D',
    'copyTexSubImage2D', 'cullFace', 'deleteBuffer', 'deleteFramebuffer',
    'deleteProgram', 'deleteRenderbuffer', 'deleteShader', 'deleteTexture',
    'depthFunc', 'depthMask', 'depthRange', 'detachShader', 'disable',
    'disableVertexAttribArray', 'drawArrays', 'drawElements', 'enable',
    'enableVertexAttribArray', 'finish', 'flush', 'framebufferRenderbuffer',
    'framebufferTexture2D', 'frontFace', 'generateMipmap', 'getActiveAttrib',
    'getActiveUniform', 'getError',
    'getRenderbufferParameter', 'getShaderPrecisionFormat',
    'getShaderSource', 'getTexParameter', 'getUniform', 'getUniformLocation',
    'getVertexAttrib', 'getVertexAttribOffset', 'hint', 'isBuffer',
    'isEnabled', 'isFramebuffer', 'isProgram', 'isRenderbuffer', 'isShader',
    'isTexture', 'lineWidth', 'linkProgram', 'pixelStorei', 'polygonOffset',
    'readPixels', 'renderbufferStorage', 'sampleCoverage', 'scissor',
    'shaderSource', 'stencilFunc', 'stencilFuncSeparate', 'stencilMask',
    'stencilMaskSeparate', 'stencilOp', 'stencilOpSeparate', 'texParameterf',
    'texParameteri', 'texImage2D', 'texSubImage2D', 'uniform1f', 'uniform1fv',
    'uniform1i', 'uniform1iv', 'uniform2f', 'uniform2fv', 'uniform2i',
    'uniform2iv', 'uniform3f', 'uniform3fv', 'uniform3i', 'uniform3iv',
    'uniform4f', 'uniform4fv', 'uniform4i', 'uniform4iv', 'uniformMatrix2fv',
    'uniformMatrix3fv', 'uniformMatrix4fv', 'useProgram', 'validateProgram',
    'vertexAttrib1f', 'vertexAttrib1fv', 'vertexAttrib2f', 'vertexAttrib2fv',
    'vertexAttrib3f', 'vertexAttrib3fv', 'vertexAttrib4f', 'vertexAttrib4fv',
    'vertexAttribPointer', 'viewport',
];

/** WebGL2-specific method names (no-ops) */
const webgl2Methods = [
    'bindVertexArray', 'deleteVertexArray', 'readBuffer',
    'getBufferSubData', 'bindBufferBase', 'bindBufferRange',
    'beginQuery', 'endQuery', 'getQuery', 'getQueryParameter',
    'drawBuffers', 'clearBufferfv', 'clearBufferiv', 'clearBufferuiv',
    'clearBufferfi', 'vertexAttribIPointer', 'vertexAttribDivisor',
    'drawArraysInstanced', 'drawElementsInstanced',
    'texStorage2D', 'texStorage3D', 'texImage3D', 'texSubImage3D',
    'renderbufferStorageMultisample', 'blitFramebuffer',
    'invalidateFramebuffer', 'invalidateSubFramebuffer',
    'uniform1ui', 'uniform2ui', 'uniform3ui', 'uniform4ui',
    'uniformMatrix2x3fv', 'uniformMatrix3x2fv', 'uniformMatrix2x4fv',
    'uniformMatrix4x2fv', 'uniformMatrix3x4fv', 'uniformMatrix4x3fv',
];

let _idCounter = 1;

/**
 * A null/stub WebGL2RenderingContext following the luma.gl NullDevice pattern.
 * All methods are vi.fn() stubs, all enum constants are correct values.
 * Methods that create resources return opaque stub objects.
 */
export class NullWebGL2RenderingContext {
    readonly canvas: HTMLCanvasElement;
    private _contextAttributes: WebGLContextAttributes | null;

    constructor(canvas: HTMLCanvasElement, contextAttributes?: WebGLContextAttributes) {
        this.canvas = canvas;
        this._contextAttributes = contextAttributes ?? null;

        // No-op methods must be per-instance so vi.fn() call tracking is isolated between tests.
        for (const method of [...webgl1Methods, ...webgl2Methods]) {
            (this as any)[method] = vi.fn();
        }
    }

    // Defined as configurable getters after the class so vi.spyOn can override them.
    declare drawingBufferWidth: number;
    declare drawingBufferHeight: number;

    // --- Methods that need non-trivial return values ---
    getParameter = vi.fn((pname: number) => {
        if (pname === allEnums.VERSION) return 'WebGL 2.0';
        if (pname === allEnums.MAX_TEXTURE_SIZE) return 4096;
        if (pname === allEnums.MAX_TEXTURE_IMAGE_UNITS) return 16;
        return 0;
    });
    getExtension = vi.fn((_name: string): any => {
        // Return an object for extensions maplibre probes
        if (_name === 'EXT_texture_filter_anisotropic') return {MAX_TEXTURE_MAX_ANISOTROPY_EXT: 0x84FF};
        if (_name === 'EXT_color_buffer_half_float') return {RGBA16F_EXT: 0x881A, RGB16F_EXT: 0x881B};
        if (_name === 'EXT_color_buffer_float') return {};
        return null;
    });
    getContextAttributes = vi.fn(() => this._contextAttributes);
    getSupportedExtensions = vi.fn((): string[] => []);
    isContextLost = vi.fn((): boolean => false);
    getShaderParameter = vi.fn((): any => true);
    getProgramParameter = vi.fn((): any => true);
    getAttribLocation = vi.fn((): number => 0);
    getShaderInfoLog = vi.fn((): string => '');
    getProgramInfoLog = vi.fn((): string => '');
    createBuffer = vi.fn((): WebGLBuffer => ({__id: _idCounter++} as any));
    createTexture = vi.fn((): WebGLTexture => ({__id: _idCounter++} as any));
    createFramebuffer = vi.fn((): WebGLFramebuffer => ({__id: _idCounter++} as any));
    createRenderbuffer = vi.fn((): WebGLRenderbuffer => ({__id: _idCounter++} as any));
    createProgram = vi.fn((): WebGLProgram => ({__id: _idCounter++} as any));
    createShader = vi.fn((): WebGLShader => ({__id: _idCounter++} as any));
    createVertexArray = vi.fn((): WebGLVertexArrayObject => ({__id: _idCounter++} as any));
    createQuery = vi.fn((): WebGLQuery => ({__id: _idCounter++} as any));
    fenceSync = vi.fn((): WebGLSync => ({__id: _idCounter++} as any));
    clientWaitSync = vi.fn((): number => allEnums.CONDITION_SATISFIED);
    deleteSync = vi.fn();
    checkFramebufferStatus = vi.fn((): number => allEnums.FRAMEBUFFER_COMPLETE);
}

// Enum constants are immutable — assign once on the prototype instead of per-instance.
for (const [k, v] of Object.entries(allEnums)) {
    (NullWebGL2RenderingContext.prototype as any)[k] = v;
}


// Configurable getters so vi.spyOn(..., 'get') works in tests.
Object.defineProperty(NullWebGL2RenderingContext.prototype, 'drawingBufferWidth', {
    get() { return this.canvas?.width ?? 300; },
    configurable: true,
});
Object.defineProperty(NullWebGL2RenderingContext.prototype, 'drawingBufferHeight', {
    get() { return this.canvas?.height ?? 150; },
    configurable: true,
});

/**
 * Create a NullWebGL2RenderingContext suitable for use with maplibre's Context class.
 */
export function createNullGL(): WebGL2RenderingContext {
    const c = document.createElement('canvas');
    return new NullWebGL2RenderingContext(c) as unknown as WebGL2RenderingContext;
}

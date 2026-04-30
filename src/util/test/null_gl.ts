import {vi} from 'vitest';

/**
 * A null/stub WebGL2RenderingContext following the luma.gl NullDevice pattern.
 * All methods are vi.fn() stubs, all enum constants are correct values.
 * Methods that create resources return opaque stub objects.
 */
export class NullWebGL2RenderingContext {
    private readonly canvas: HTMLCanvasElement;
    private _contextAttributes: WebGLContextAttributes | null;
    private static _idCounter = 1;
    /**
     * WebGL1 constants
     */
    VERSION: number = 0x1F02;
    MAX_TEXTURE_SIZE: number = 0x0D33;
    COLOR_ATTACHMENT0: number = 0x8CE0;
    FRAMEBUFFER: number = 0x8D40;
    RENDERBUFFER: number = 0x8D41;
    FRAMEBUFFER_COMPLETE: number = 0x8CD5;
    DEPTH_BUFFER_BIT: number = 0x00000100;
    STENCIL_BUFFER_BIT: number = 0x00000400;
    COLOR_BUFFER_BIT: number = 0x00004000;
    POINTS: number = 0;
    LINES: number = 1;
    LINE_LOOP: number = 2;
    LINE_STRIP: number = 3;
    TRIANGLES: number = 4;
    TRIANGLE_STRIP: number = 5;
    TRIANGLE_FAN: number = 6;
    ZERO: number = 0;
    ONE: number = 1;
    SRC_COLOR: number = 0x0300;
    ONE_MINUS_SRC_COLOR: number = 0x0301;
    SRC_ALPHA: number = 0x0302;
    ONE_MINUS_SRC_ALPHA: number = 0x0303;
    DST_ALPHA: number = 0x0304;
    ONE_MINUS_DST_ALPHA: number = 0x0305;
    DST_COLOR: number = 0x0306;
    ONE_MINUS_DST_COLOR: number = 0x0307;
    CONSTANT_COLOR: number = 0x8001;
    FUNC_ADD: number = 0x8006;
    BLEND: number = 0x0BE2;
    DEPTH_TEST: number = 0x0B71;
    STENCIL_TEST: number = 0x0B90;
    CULL_FACE: number = 0x0B44;
    SCISSOR_TEST: number = 0x0C11;
    FRONT: number = 0x0404;
    BACK: number = 0x0405;
    CW: number = 0x0900;
    CCW: number = 0x0901;
    NEVER: number = 0x0200;
    LESS: number = 0x0201;
    EQUAL: number = 0x0202;
    LEQUAL: number = 0x0203;
    GREATER: number = 0x0204;
    NOTEQUAL: number = 0x0205;
    GEQUAL: number = 0x0206;
    ALWAYS: number = 0x0207;
    KEEP: number = 0x1E00;
    REPLACE: number = 0x1E01;
    INCR: number = 0x1E02;
    DECR: number = 0x1E03;
    BYTE: number = 0x1400;
    UNSIGNED_BYTE: number = 0x1401;
    SHORT: number = 0x1402;
    UNSIGNED_SHORT: number = 0x1403;
    INT: number = 0x1404;
    UNSIGNED_INT: number = 0x1405;
    FLOAT: number = 0x1406;
    ALPHA: number = 0x1906;
    RGB: number = 0x1907;
    RGBA: number = 0x1908;
    DEPTH_COMPONENT: number = 0x1902;
    DEPTH_COMPONENT16: number = 0x81A5;
    DEPTH_STENCIL: number = 0x84F9;
    DEPTH_STENCIL_ATTACHMENT: number = 0x821A;
    DEPTH_ATTACHMENT: number = 0x8D00;
    TEXTURE_2D: number = 0x0DE1;
    TEXTURE_MAG_FILTER: number = 0x2800;
    TEXTURE_MIN_FILTER: number = 0x2801;
    TEXTURE_WRAP_S: number = 0x2802;
    TEXTURE_WRAP_T: number = 0x2803;
    LINEAR: number = 0x2601;
    NEAREST: number = 0x2600;
    LINEAR_MIPMAP_NEAREST: number = 0x2701;
    NEAREST_MIPMAP_LINEAR: number = 0x2702;
    REPEAT: number = 0x2901;
    CLAMP_TO_EDGE: number = 0x812F;
    TEXTURE0: number = 0x84C0;
    TEXTURE1: number = 0x84C1;
    TEXTURE2: number = 0x84C2;
    TEXTURE3: number = 0x84C3;
    TEXTURE4: number = 0x84C4;
    ARRAY_BUFFER: number = 0x8892;
    ELEMENT_ARRAY_BUFFER: number = 0x8893;
    STATIC_DRAW: number = 0x88E4;
    DYNAMIC_DRAW: number = 0x88E8;
    VERTEX_SHADER: number = 0x8B31;
    FRAGMENT_SHADER: number = 0x8B30;
    COMPILE_STATUS: number = 0x8B81;
    LINK_STATUS: number = 0x8B82;
    UNPACK_ALIGNMENT: number = 0x0CF5;
    UNPACK_FLIP_Y_WEBGL: number = 0x9240;
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: number = 0x9241;
    MAX_TEXTURE_IMAGE_UNITS: number = 0x8872;
    /**
     * WebGL2-specific constants
     */
    PIXEL_PACK_BUFFER: number = 0x88EB;
    PIXEL_UNPACK_BUFFER: number = 0x88EC;
    PIXEL_PACK_BUFFER_BINDING: number = 0x88ED;
    PIXEL_UNPACK_BUFFER_BINDING: number = 0x88EF;
    STREAM_READ: number = 0x88E1;
    STREAM_COPY: number = 0x88E2;
    STATIC_READ: number = 0x88E5;
    STATIC_COPY: number = 0x88E6;
    DYNAMIC_READ: number = 0x88E9;
    DYNAMIC_COPY: number = 0x88EA;
    HALF_FLOAT: number = 0x140B;
    RGB16F: number = 0x881B;
    RGBA16F: number = 0x881A;
    RGB32F: number = 0x8815;
    RGBA32F: number = 0x8814;
    R16F: number = 0x822D;
    RG16F: number = 0x822F;
    SYNC_GPU_COMMANDS_COMPLETE: number = 0x9117;
    ALREADY_SIGNALED: number = 0x911A;
    TIMEOUT_EXPIRED: number = 0x911B;
    CONDITION_SATISFIED: number = 0x911C;
    WAIT_FAILED: number = 0x911D;
    SYNC_FLUSH_COMMANDS_BIT: number = 0x00000001;
    READ_BUFFER: number = 0x0C02;

    constructor(canvas: HTMLCanvasElement, contextAttributes?: WebGLContextAttributes) {
        this.canvas = canvas;
        this._contextAttributes = contextAttributes ?? null;
    }

    // Configurable getters so vi.spyOn(..., 'get') works in tests.
    get drawingBufferWidth(): number {
        return this.canvas?.width ?? 300;
    }
    get drawingBufferHeight(): number {
        return this.canvas?.height ?? 150;
    }

    // --- Methods that need non-trivial return values ---
    getParameter: ReturnType<typeof vi.fn<(pname: number) => number | string>> = vi.fn((pname: number): number | string => {
        if (pname === this.VERSION) return 'WebGL 2.0';
        if (pname === this.MAX_TEXTURE_SIZE) return 4096;
        if (pname === this.MAX_TEXTURE_IMAGE_UNITS) return 16;
        return 0;
    });
    getExtension: ReturnType<typeof vi.fn<(_name: string) => any>> = vi.fn((_name: string): any => {
        // Return an object for extensions maplibre probes
        if (_name === 'EXT_texture_filter_anisotropic') return {MAX_TEXTURE_MAX_ANISOTROPY_EXT: 0x84FF};
        if (_name === 'EXT_color_buffer_half_float') return {RGBA16F_EXT: 0x881A, RGB16F_EXT: 0x881B};
        if (_name === 'EXT_color_buffer_float') return {};
        return null;
    });
    getContextAttributes: ReturnType<typeof vi.fn<() => WebGLContextAttributes | null>> = vi.fn((): WebGLContextAttributes | null => this._contextAttributes);
    getSupportedExtensions: ReturnType<typeof vi.fn<() => string[]>> = vi.fn((): string[] => []);
    isContextLost: ReturnType<typeof vi.fn<() => boolean>> = vi.fn((): boolean => false);
    getShaderParameter: ReturnType<typeof vi.fn<() => any>> = vi.fn((): any => true);
    getProgramParameter: ReturnType<typeof vi.fn<() => any>> = vi.fn((): any => true);
    getAttribLocation: ReturnType<typeof vi.fn<() => number>> = vi.fn((): number => 0);
    getShaderInfoLog: ReturnType<typeof vi.fn<() => string>> = vi.fn((): string => '');
    getProgramInfoLog: ReturnType<typeof vi.fn<() => string>> = vi.fn((): string => '');
    createBuffer: ReturnType<typeof vi.fn<() => WebGLBuffer>> = vi.fn((): WebGLBuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createTexture: ReturnType<typeof vi.fn<() => WebGLTexture>> = vi.fn((): WebGLTexture => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createFramebuffer: ReturnType<typeof vi.fn<() => WebGLFramebuffer>> = vi.fn((): WebGLFramebuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createRenderbuffer: ReturnType<typeof vi.fn<() => WebGLRenderbuffer>> = vi.fn((): WebGLRenderbuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createProgram: ReturnType<typeof vi.fn<() => WebGLProgram>> = vi.fn((): WebGLProgram => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createShader: ReturnType<typeof vi.fn<() => WebGLShader>> = vi.fn((): WebGLShader => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createVertexArray: ReturnType<typeof vi.fn<() => WebGLVertexArrayObject>> = vi.fn((): WebGLVertexArrayObject => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createQuery: ReturnType<typeof vi.fn<() => WebGLQuery>> = vi.fn((): WebGLQuery => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    fenceSync: ReturnType<typeof vi.fn<() => WebGLSync>> = vi.fn((): WebGLSync => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    clientWaitSync: ReturnType<typeof vi.fn<() => number>> = vi.fn((): number => this.CONDITION_SATISFIED);
    deleteSync: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    checkFramebufferStatus: ReturnType<typeof vi.fn<() => number>> = vi.fn((): number => this.FRAMEBUFFER_COMPLETE);
    /** WebGL2-specific method names (no-ops) */
    bindVertexArray: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    deleteVertexArray: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    readBuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getBufferSubData: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bindBufferBase: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bindBufferRange: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    beginQuery: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    endQuery: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getQuery: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getQueryParameter: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    drawBuffers: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    clearBufferfv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    clearBufferiv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    clearBufferuiv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    clearBufferfi: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttribIPointer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttribDivisor: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    drawArraysInstanced: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    drawElementsInstanced: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    texStorage2D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    texStorage3D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    texImage3D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    texSubImage3D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    renderbufferStorageMultisample: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    blitFramebuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    invalidateFramebuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    invalidateSubFramebuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform1ui: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform2ui: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform3ui: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform4ui: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix2x3fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix3x2fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix2x4fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix4x2fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix3x4fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix4x3fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    /** All WebGL1 method names that return a generic stub value */
    activeTexture: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    attachShader: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bindAttribLocation: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bindBuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bindFramebuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bindRenderbuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bindTexture: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    blendColor: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    blendEquation: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    blendEquationSeparate: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    blendFunc: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    blendFuncSeparate: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bufferData: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    bufferSubData: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    clear: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    clearColor: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    clearDepth: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    clearStencil: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    colorMask: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    compileShader: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    copyTexImage2D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    copyTexSubImage2D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    cullFace: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    deleteBuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    deleteFramebuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    deleteProgram: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    deleteRenderbuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    deleteShader: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    deleteTexture: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    depthFunc: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    depthMask: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    depthRange: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    detachShader: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    disable: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    disableVertexAttribArray: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    drawArrays: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    drawElements: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    enable: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    enableVertexAttribArray: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    finish: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    flush: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    framebufferRenderbuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    framebufferTexture2D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    frontFace: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    generateMipmap: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getActiveAttrib: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getActiveUniform: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getError: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getRenderbufferParameter: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getShaderPrecisionFormat: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getShaderSource: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getTexParameter: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getUniform: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getUniformLocation: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getVertexAttrib: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    getVertexAttribOffset: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    hint: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    isBuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    isEnabled: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    isFramebuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    isProgram: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    isRenderbuffer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    isShader: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    isTexture: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    lineWidth: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    linkProgram: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    pixelStorei: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    polygonOffset: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    readPixels: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    renderbufferStorage: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    sampleCoverage: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    scissor: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    shaderSource: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    stencilFunc: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    stencilFuncSeparate: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    stencilMask: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    stencilMaskSeparate: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    stencilOp: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    stencilOpSeparate: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    texParameterf: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    texParameteri: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    texImage2D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    texSubImage2D: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform1f: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform1fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform1i: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform1iv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform2f: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform2fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform2i: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform2iv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform3f: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform3fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform3i: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform3iv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform4f: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform4fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform4i: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniform4iv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix2fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix3fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    uniformMatrix4fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    useProgram: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    validateProgram: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttrib1f: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttrib1fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttrib2f: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttrib2fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttrib3f: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttrib3fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttrib4f: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttrib4fv: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    vertexAttribPointer: ReturnType<typeof vi.fn<() => void>> = vi.fn();
    viewport: ReturnType<typeof vi.fn<() => void>> = vi.fn();
}

/**
 * Create a NullWebGL2RenderingContext suitable for use with maplibre's Context class.
 */
export function createNullGL(): WebGL2RenderingContext {
    const c = document.createElement('canvas');
    return new NullWebGL2RenderingContext(c) as unknown as WebGL2RenderingContext;
}

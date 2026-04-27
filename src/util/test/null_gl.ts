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
    VERSION = 0x1F02;
    MAX_TEXTURE_SIZE = 0x0D33;
    COLOR_ATTACHMENT0 = 0x8CE0;
    FRAMEBUFFER = 0x8D40;
    RENDERBUFFER = 0x8D41;
    FRAMEBUFFER_COMPLETE = 0x8CD5;
    DEPTH_BUFFER_BIT = 0x00000100;
    STENCIL_BUFFER_BIT = 0x00000400;
    COLOR_BUFFER_BIT = 0x00004000;
    POINTS = 0;
    LINES = 1;
    LINE_LOOP = 2;
    LINE_STRIP = 3;
    TRIANGLES = 4;
    TRIANGLE_STRIP = 5;
    TRIANGLE_FAN = 6;
    ZERO = 0;
    ONE = 1;
    SRC_COLOR = 0x0300;
    ONE_MINUS_SRC_COLOR = 0x0301;
    SRC_ALPHA = 0x0302;
    ONE_MINUS_SRC_ALPHA = 0x0303;
    DST_ALPHA = 0x0304;
    ONE_MINUS_DST_ALPHA = 0x0305;
    DST_COLOR = 0x0306;
    ONE_MINUS_DST_COLOR = 0x0307;
    CONSTANT_COLOR = 0x8001;
    FUNC_ADD = 0x8006;
    BLEND = 0x0BE2;
    DEPTH_TEST = 0x0B71;
    STENCIL_TEST = 0x0B90;
    CULL_FACE = 0x0B44;
    SCISSOR_TEST = 0x0C11;
    FRONT = 0x0404;
    BACK = 0x0405;
    CW = 0x0900;
    CCW = 0x0901;
    NEVER = 0x0200;
    LESS = 0x0201;
    EQUAL = 0x0202;
    LEQUAL = 0x0203;
    GREATER = 0x0204;
    NOTEQUAL = 0x0205;
    GEQUAL = 0x0206;
    ALWAYS = 0x0207;
    KEEP = 0x1E00;
    REPLACE = 0x1E01;
    INCR = 0x1E02;
    DECR = 0x1E03;
    BYTE = 0x1400;
    UNSIGNED_BYTE = 0x1401;
    SHORT = 0x1402;
    UNSIGNED_SHORT = 0x1403;
    INT = 0x1404;
    UNSIGNED_INT = 0x1405;
    FLOAT = 0x1406;
    ALPHA = 0x1906;
    RGB = 0x1907;
    RGBA = 0x1908;
    DEPTH_COMPONENT = 0x1902;
    DEPTH_COMPONENT16 = 0x81A5;
    DEPTH_STENCIL = 0x84F9;
    DEPTH_STENCIL_ATTACHMENT = 0x821A;
    DEPTH_ATTACHMENT = 0x8D00;
    TEXTURE_2D = 0x0DE1;
    TEXTURE_MAG_FILTER = 0x2800;
    TEXTURE_MIN_FILTER = 0x2801;
    TEXTURE_WRAP_S = 0x2802;
    TEXTURE_WRAP_T = 0x2803;
    LINEAR = 0x2601;
    NEAREST = 0x2600;
    LINEAR_MIPMAP_NEAREST = 0x2701;
    NEAREST_MIPMAP_LINEAR = 0x2702;
    REPEAT = 0x2901;
    CLAMP_TO_EDGE = 0x812F;
    TEXTURE0 = 0x84C0;
    TEXTURE1 = 0x84C1;
    TEXTURE2 = 0x84C2;
    TEXTURE3 = 0x84C3;
    TEXTURE4 = 0x84C4;
    ARRAY_BUFFER = 0x8892;
    ELEMENT_ARRAY_BUFFER = 0x8893;
    STATIC_DRAW = 0x88E4;
    DYNAMIC_DRAW = 0x88E8;
    VERTEX_SHADER = 0x8B31;
    FRAGMENT_SHADER = 0x8B30;
    COMPILE_STATUS = 0x8B81;
    LINK_STATUS = 0x8B82;
    UNPACK_ALIGNMENT = 0x0CF5;
    UNPACK_FLIP_Y_WEBGL = 0x9240;
    UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241;
    MAX_TEXTURE_IMAGE_UNITS = 0x8872;
    /**
     * WebGL2-specific constants
     */
    PIXEL_PACK_BUFFER = 0x88EB;
    PIXEL_UNPACK_BUFFER = 0x88EC;
    PIXEL_PACK_BUFFER_BINDING = 0x88ED;
    PIXEL_UNPACK_BUFFER_BINDING = 0x88EF;
    STREAM_READ = 0x88E1;
    STREAM_COPY = 0x88E2;
    STATIC_READ = 0x88E5;
    STATIC_COPY = 0x88E6;
    DYNAMIC_READ = 0x88E9;
    DYNAMIC_COPY = 0x88EA;
    HALF_FLOAT = 0x140B;
    RGB16F = 0x881B;
    RGBA16F = 0x881A;
    RGB32F = 0x8815;
    RGBA32F = 0x8814;
    R16F = 0x822D;
    RG16F = 0x822F;
    SYNC_GPU_COMMANDS_COMPLETE = 0x9117;
    ALREADY_SIGNALED = 0x911A;
    TIMEOUT_EXPIRED = 0x911B;
    CONDITION_SATISFIED = 0x911C;
    WAIT_FAILED = 0x911D;
    SYNC_FLUSH_COMMANDS_BIT = 0x00000001;
    READ_BUFFER = 0x0C02;

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
    getParameter = vi.fn((pname: number) => {
        if (pname === this.VERSION) return 'WebGL 2.0';
        if (pname === this.MAX_TEXTURE_SIZE) return 4096;
        if (pname === this.MAX_TEXTURE_IMAGE_UNITS) return 16;
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
    createBuffer = vi.fn((): WebGLBuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createTexture = vi.fn((): WebGLTexture => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createFramebuffer = vi.fn((): WebGLFramebuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createRenderbuffer = vi.fn((): WebGLRenderbuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createProgram = vi.fn((): WebGLProgram => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createShader = vi.fn((): WebGLShader => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createVertexArray = vi.fn((): WebGLVertexArrayObject => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createQuery = vi.fn((): WebGLQuery => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    fenceSync = vi.fn((): WebGLSync => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    clientWaitSync = vi.fn((): number => this.CONDITION_SATISFIED);
    deleteSync = vi.fn();
    checkFramebufferStatus = vi.fn((): number => this.FRAMEBUFFER_COMPLETE);
    /** WebGL2-specific method names (no-ops) */
    bindVertexArray = vi.fn();
    deleteVertexArray = vi.fn();
    readBuffer = vi.fn();
    getBufferSubData = vi.fn();
    bindBufferBase = vi.fn();
    bindBufferRange = vi.fn();
    beginQuery = vi.fn();
    endQuery = vi.fn();
    getQuery = vi.fn();
    getQueryParameter = vi.fn();
    drawBuffers = vi.fn();
    clearBufferfv = vi.fn();
    clearBufferiv = vi.fn();
    clearBufferuiv = vi.fn();
    clearBufferfi = vi.fn();
    vertexAttribIPointer = vi.fn();
    vertexAttribDivisor = vi.fn();
    drawArraysInstanced = vi.fn();
    drawElementsInstanced = vi.fn();
    texStorage2D = vi.fn();
    texStorage3D = vi.fn();
    texImage3D = vi.fn();
    texSubImage3D = vi.fn();
    renderbufferStorageMultisample = vi.fn();
    blitFramebuffer = vi.fn();
    invalidateFramebuffer = vi.fn();
    invalidateSubFramebuffer = vi.fn();
    uniform1ui = vi.fn();
    uniform2ui = vi.fn();
    uniform3ui = vi.fn();
    uniform4ui = vi.fn();
    uniformMatrix2x3fv = vi.fn();
    uniformMatrix3x2fv = vi.fn();
    uniformMatrix2x4fv = vi.fn();
    uniformMatrix4x2fv = vi.fn();
    uniformMatrix3x4fv = vi.fn();
    uniformMatrix4x3fv = vi.fn();
    /** All WebGL1 method names that return a generic stub value */
    activeTexture = vi.fn();
    attachShader = vi.fn();
    bindAttribLocation = vi.fn();
    bindBuffer = vi.fn();
    bindFramebuffer = vi.fn();
    bindRenderbuffer = vi.fn();
    bindTexture = vi.fn();
    blendColor = vi.fn();
    blendEquation = vi.fn();
    blendEquationSeparate = vi.fn();
    blendFunc = vi.fn();
    blendFuncSeparate = vi.fn();
    bufferData = vi.fn();
    bufferSubData = vi.fn();
    clear = vi.fn();
    clearColor = vi.fn();
    clearDepth = vi.fn();
    clearStencil = vi.fn();
    colorMask = vi.fn();
    compileShader = vi.fn();
    copyTexImage2D = vi.fn();
    copyTexSubImage2D = vi.fn();
    cullFace = vi.fn();
    deleteBuffer = vi.fn();
    deleteFramebuffer = vi.fn();
    deleteProgram = vi.fn();
    deleteRenderbuffer = vi.fn();
    deleteShader = vi.fn();
    deleteTexture = vi.fn();
    depthFunc = vi.fn();
    depthMask = vi.fn();
    depthRange = vi.fn();
    detachShader = vi.fn();
    disable = vi.fn();
    disableVertexAttribArray = vi.fn();
    drawArrays = vi.fn();
    drawElements = vi.fn();
    enable = vi.fn();
    enableVertexAttribArray = vi.fn();
    finish = vi.fn();
    flush = vi.fn();
    framebufferRenderbuffer = vi.fn();
    framebufferTexture2D = vi.fn();
    frontFace = vi.fn();
    generateMipmap = vi.fn();
    getActiveAttrib = vi.fn();
    getActiveUniform = vi.fn();
    getError = vi.fn();
    getRenderbufferParameter = vi.fn();
    getShaderPrecisionFormat = vi.fn();
    getShaderSource = vi.fn();
    getTexParameter = vi.fn();
    getUniform = vi.fn();
    getUniformLocation = vi.fn();
    getVertexAttrib = vi.fn();
    getVertexAttribOffset = vi.fn();
    hint = vi.fn();
    isBuffer = vi.fn();
    isEnabled = vi.fn();
    isFramebuffer = vi.fn();
    isProgram = vi.fn();
    isRenderbuffer = vi.fn();
    isShader = vi.fn();
    isTexture = vi.fn();
    lineWidth = vi.fn();
    linkProgram = vi.fn();
    pixelStorei = vi.fn();
    polygonOffset = vi.fn();
    readPixels = vi.fn();
    renderbufferStorage = vi.fn();
    sampleCoverage = vi.fn();
    scissor = vi.fn();
    shaderSource = vi.fn();
    stencilFunc = vi.fn();
    stencilFuncSeparate = vi.fn();
    stencilMask = vi.fn();
    stencilMaskSeparate = vi.fn();
    stencilOp = vi.fn();
    stencilOpSeparate = vi.fn();
    texParameterf = vi.fn();
    texParameteri = vi.fn();
    texImage2D = vi.fn();
    texSubImage2D = vi.fn();
    uniform1f = vi.fn();
    uniform1fv = vi.fn();
    uniform1i = vi.fn();
    uniform1iv = vi.fn();
    uniform2f = vi.fn();
    uniform2fv = vi.fn();
    uniform2i = vi.fn();
    uniform2iv = vi.fn();
    uniform3f = vi.fn();
    uniform3fv = vi.fn();
    uniform3i = vi.fn();
    uniform3iv = vi.fn();
    uniform4f = vi.fn();
    uniform4fv = vi.fn();
    uniform4i = vi.fn();
    uniform4iv = vi.fn();
    uniformMatrix2fv = vi.fn();
    uniformMatrix3fv = vi.fn();
    uniformMatrix4fv = vi.fn();
    useProgram = vi.fn();
    validateProgram = vi.fn();
    vertexAttrib1f = vi.fn();
    vertexAttrib1fv = vi.fn();
    vertexAttrib2f = vi.fn();
    vertexAttrib2fv = vi.fn();
    vertexAttrib3f = vi.fn();
    vertexAttrib3fv = vi.fn();
    vertexAttrib4f = vi.fn();
    vertexAttrib4fv = vi.fn();
    vertexAttribPointer = vi.fn();
    viewport = vi.fn();
}

/**
 * Create a NullWebGL2RenderingContext suitable for use with maplibre's Context class.
 */
export function createNullGL(): WebGL2RenderingContext {
    const c = document.createElement('canvas');
    return new NullWebGL2RenderingContext(c) as unknown as WebGL2RenderingContext;
}

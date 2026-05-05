import {vi, type Mock} from 'vitest';

type GL = WebGL2RenderingContext;

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
    getParameter: Mock<GL['getParameter']> = vi.fn((pname: number) => {
        if (pname === this.VERSION) return 'WebGL 2.0';
        if (pname === this.MAX_TEXTURE_SIZE) return 4096;
        if (pname === this.MAX_TEXTURE_IMAGE_UNITS) return 16;
        return 0;
    });
    getExtension: Mock<GL['getExtension']> = vi.fn((_name: string): any => {
        // Return an object for extensions maplibre probes
        if (_name === 'EXT_texture_filter_anisotropic') return {MAX_TEXTURE_MAX_ANISOTROPY_EXT: 0x84FF};
        if (_name === 'EXT_color_buffer_half_float') return {RGBA16F_EXT: 0x881A, RGB16F_EXT: 0x881B};
        if (_name === 'EXT_color_buffer_float') return {};
        return null;
    }) as Mock<GL['getExtension']>;
    getContextAttributes: Mock<GL['getContextAttributes']> = vi.fn((): WebGLContextAttributes | null => this._contextAttributes);
    getSupportedExtensions: Mock<GL['getSupportedExtensions']> = vi.fn((): string[] => []);
    isContextLost: Mock<GL['isContextLost']> = vi.fn((): boolean => false);
    getShaderParameter: Mock<GL['getShaderParameter']> = vi.fn((): any => true);
    getProgramParameter: Mock<GL['getProgramParameter']> = vi.fn((): any => true);
    getAttribLocation: Mock<GL['getAttribLocation']> = vi.fn((): number => 0);
    getShaderInfoLog: Mock<GL['getShaderInfoLog']> = vi.fn((): string => '');
    getProgramInfoLog: Mock<GL['getProgramInfoLog']> = vi.fn((): string => '');
    createBuffer: Mock<GL['createBuffer']> = vi.fn((): WebGLBuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createTexture: Mock<GL['createTexture']> = vi.fn((): WebGLTexture => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createFramebuffer: Mock<GL['createFramebuffer']> = vi.fn((): WebGLFramebuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createRenderbuffer: Mock<GL['createRenderbuffer']> = vi.fn((): WebGLRenderbuffer => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createProgram: Mock<GL['createProgram']> = vi.fn((): WebGLProgram => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createShader: Mock<GL['createShader']> = vi.fn((): WebGLShader => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createVertexArray: Mock<GL['createVertexArray']> = vi.fn((): WebGLVertexArrayObject => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    createQuery: Mock<GL['createQuery']> = vi.fn((): WebGLQuery => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    fenceSync: Mock<GL['fenceSync']> = vi.fn((): WebGLSync => ({__id: NullWebGL2RenderingContext._idCounter++} as any));
    clientWaitSync: Mock<GL['clientWaitSync']> = vi.fn((): number => this.CONDITION_SATISFIED);
    deleteSync: Mock<GL['deleteSync']> = vi.fn();
    checkFramebufferStatus: Mock<GL['checkFramebufferStatus']> = vi.fn((): number => this.FRAMEBUFFER_COMPLETE);
    /** WebGL2-specific method names (no-ops) */
    bindVertexArray: Mock<GL['bindVertexArray']> = vi.fn();
    deleteVertexArray: Mock<GL['deleteVertexArray']> = vi.fn();
    readBuffer: Mock<GL['readBuffer']> = vi.fn();
    getBufferSubData: Mock<GL['getBufferSubData']> = vi.fn();
    bindBufferBase: Mock<GL['bindBufferBase']> = vi.fn();
    bindBufferRange: Mock<GL['bindBufferRange']> = vi.fn();
    beginQuery: Mock<GL['beginQuery']> = vi.fn();
    endQuery: Mock<GL['endQuery']> = vi.fn();
    getQuery: Mock<GL['getQuery']> = vi.fn();
    getQueryParameter: Mock<GL['getQueryParameter']> = vi.fn();
    drawBuffers: Mock<GL['drawBuffers']> = vi.fn();
    clearBufferfv: Mock<GL['clearBufferfv']> = vi.fn();
    clearBufferiv: Mock<GL['clearBufferiv']> = vi.fn();
    clearBufferuiv: Mock<GL['clearBufferuiv']> = vi.fn();
    clearBufferfi: Mock<GL['clearBufferfi']> = vi.fn();
    vertexAttribIPointer: Mock<GL['vertexAttribIPointer']> = vi.fn();
    vertexAttribDivisor: Mock<GL['vertexAttribDivisor']> = vi.fn();
    drawArraysInstanced: Mock<GL['drawArraysInstanced']> = vi.fn();
    drawElementsInstanced: Mock<GL['drawElementsInstanced']> = vi.fn();
    texStorage2D: Mock<GL['texStorage2D']> = vi.fn();
    texStorage3D: Mock<GL['texStorage3D']> = vi.fn();
    texImage3D: Mock<GL['texImage3D']> = vi.fn();
    texSubImage3D: Mock<GL['texSubImage3D']> = vi.fn();
    renderbufferStorageMultisample: Mock<GL['renderbufferStorageMultisample']> = vi.fn();
    blitFramebuffer: Mock<GL['blitFramebuffer']> = vi.fn();
    invalidateFramebuffer: Mock<GL['invalidateFramebuffer']> = vi.fn();
    invalidateSubFramebuffer: Mock<GL['invalidateSubFramebuffer']> = vi.fn();
    uniform1ui: Mock<GL['uniform1ui']> = vi.fn();
    uniform2ui: Mock<GL['uniform2ui']> = vi.fn();
    uniform3ui: Mock<GL['uniform3ui']> = vi.fn();
    uniform4ui: Mock<GL['uniform4ui']> = vi.fn();
    uniformMatrix2x3fv: Mock<GL['uniformMatrix2x3fv']> = vi.fn();
    uniformMatrix3x2fv: Mock<GL['uniformMatrix3x2fv']> = vi.fn();
    uniformMatrix2x4fv: Mock<GL['uniformMatrix2x4fv']> = vi.fn();
    uniformMatrix4x2fv: Mock<GL['uniformMatrix4x2fv']> = vi.fn();
    uniformMatrix3x4fv: Mock<GL['uniformMatrix3x4fv']> = vi.fn();
    uniformMatrix4x3fv: Mock<GL['uniformMatrix4x3fv']> = vi.fn();
    /** All WebGL1 method names that return a generic stub value */
    activeTexture: Mock<GL['activeTexture']> = vi.fn();
    attachShader: Mock<GL['attachShader']> = vi.fn();
    bindAttribLocation: Mock<GL['bindAttribLocation']> = vi.fn();
    bindBuffer: Mock<GL['bindBuffer']> = vi.fn();
    bindFramebuffer: Mock<GL['bindFramebuffer']> = vi.fn();
    bindRenderbuffer: Mock<GL['bindRenderbuffer']> = vi.fn();
    bindTexture: Mock<GL['bindTexture']> = vi.fn();
    blendColor: Mock<GL['blendColor']> = vi.fn();
    blendEquation: Mock<GL['blendEquation']> = vi.fn();
    blendEquationSeparate: Mock<GL['blendEquationSeparate']> = vi.fn();
    blendFunc: Mock<GL['blendFunc']> = vi.fn();
    blendFuncSeparate: Mock<GL['blendFuncSeparate']> = vi.fn();
    bufferData: Mock<GL['bufferData']> = vi.fn();
    bufferSubData: Mock<GL['bufferSubData']> = vi.fn();
    clear: Mock<GL['clear']> = vi.fn();
    clearColor: Mock<GL['clearColor']> = vi.fn();
    clearDepth: Mock<GL['clearDepth']> = vi.fn();
    clearStencil: Mock<GL['clearStencil']> = vi.fn();
    colorMask: Mock<GL['colorMask']> = vi.fn();
    compileShader: Mock<GL['compileShader']> = vi.fn();
    copyTexImage2D: Mock<GL['copyTexImage2D']> = vi.fn();
    copyTexSubImage2D: Mock<GL['copyTexSubImage2D']> = vi.fn();
    cullFace: Mock<GL['cullFace']> = vi.fn();
    deleteBuffer: Mock<GL['deleteBuffer']> = vi.fn();
    deleteFramebuffer: Mock<GL['deleteFramebuffer']> = vi.fn();
    deleteProgram: Mock<GL['deleteProgram']> = vi.fn();
    deleteRenderbuffer: Mock<GL['deleteRenderbuffer']> = vi.fn();
    deleteShader: Mock<GL['deleteShader']> = vi.fn();
    deleteTexture: Mock<GL['deleteTexture']> = vi.fn();
    depthFunc: Mock<GL['depthFunc']> = vi.fn();
    depthMask: Mock<GL['depthMask']> = vi.fn();
    depthRange: Mock<GL['depthRange']> = vi.fn();
    detachShader: Mock<GL['detachShader']> = vi.fn();
    disable: Mock<GL['disable']> = vi.fn();
    disableVertexAttribArray: Mock<GL['disableVertexAttribArray']> = vi.fn();
    drawArrays: Mock<GL['drawArrays']> = vi.fn();
    drawElements: Mock<GL['drawElements']> = vi.fn();
    enable: Mock<GL['enable']> = vi.fn();
    enableVertexAttribArray: Mock<GL['enableVertexAttribArray']> = vi.fn();
    finish: Mock<GL['finish']> = vi.fn();
    flush: Mock<GL['flush']> = vi.fn();
    framebufferRenderbuffer: Mock<GL['framebufferRenderbuffer']> = vi.fn();
    framebufferTexture2D: Mock<GL['framebufferTexture2D']> = vi.fn();
    frontFace: Mock<GL['frontFace']> = vi.fn();
    generateMipmap: Mock<GL['generateMipmap']> = vi.fn();
    getActiveAttrib: Mock<GL['getActiveAttrib']> = vi.fn();
    getActiveUniform: Mock<GL['getActiveUniform']> = vi.fn();
    getError: Mock<GL['getError']> = vi.fn();
    getRenderbufferParameter: Mock<GL['getRenderbufferParameter']> = vi.fn();
    getShaderPrecisionFormat: Mock<GL['getShaderPrecisionFormat']> = vi.fn();
    getShaderSource: Mock<GL['getShaderSource']> = vi.fn();
    getTexParameter: Mock<GL['getTexParameter']> = vi.fn();
    getUniform: Mock<GL['getUniform']> = vi.fn();
    getUniformLocation: Mock<GL['getUniformLocation']> = vi.fn();
    getVertexAttrib: Mock<GL['getVertexAttrib']> = vi.fn();
    getVertexAttribOffset: Mock<GL['getVertexAttribOffset']> = vi.fn();
    hint: Mock<GL['hint']> = vi.fn();
    isBuffer: Mock<GL['isBuffer']> = vi.fn();
    isEnabled: Mock<GL['isEnabled']> = vi.fn();
    isFramebuffer: Mock<GL['isFramebuffer']> = vi.fn();
    isProgram: Mock<GL['isProgram']> = vi.fn();
    isRenderbuffer: Mock<GL['isRenderbuffer']> = vi.fn();
    isShader: Mock<GL['isShader']> = vi.fn();
    isTexture: Mock<GL['isTexture']> = vi.fn();
    lineWidth: Mock<GL['lineWidth']> = vi.fn();
    linkProgram: Mock<GL['linkProgram']> = vi.fn();
    pixelStorei: Mock<GL['pixelStorei']> = vi.fn();
    polygonOffset: Mock<GL['polygonOffset']> = vi.fn();
    readPixels: Mock<GL['readPixels']> = vi.fn();
    renderbufferStorage: Mock<GL['renderbufferStorage']> = vi.fn();
    sampleCoverage: Mock<GL['sampleCoverage']> = vi.fn();
    scissor: Mock<GL['scissor']> = vi.fn();
    shaderSource: Mock<GL['shaderSource']> = vi.fn();
    stencilFunc: Mock<GL['stencilFunc']> = vi.fn();
    stencilFuncSeparate: Mock<GL['stencilFuncSeparate']> = vi.fn();
    stencilMask: Mock<GL['stencilMask']> = vi.fn();
    stencilMaskSeparate: Mock<GL['stencilMaskSeparate']> = vi.fn();
    stencilOp: Mock<GL['stencilOp']> = vi.fn();
    stencilOpSeparate: Mock<GL['stencilOpSeparate']> = vi.fn();
    texParameterf: Mock<GL['texParameterf']> = vi.fn();
    texParameteri: Mock<GL['texParameteri']> = vi.fn();
    texImage2D: Mock<GL['texImage2D']> = vi.fn();
    texSubImage2D: Mock<GL['texSubImage2D']> = vi.fn();
    uniform1f: Mock<GL['uniform1f']> = vi.fn();
    uniform1fv: Mock<GL['uniform1fv']> = vi.fn();
    uniform1i: Mock<GL['uniform1i']> = vi.fn();
    uniform1iv: Mock<GL['uniform1iv']> = vi.fn();
    uniform2f: Mock<GL['uniform2f']> = vi.fn();
    uniform2fv: Mock<GL['uniform2fv']> = vi.fn();
    uniform2i: Mock<GL['uniform2i']> = vi.fn();
    uniform2iv: Mock<GL['uniform2iv']> = vi.fn();
    uniform3f: Mock<GL['uniform3f']> = vi.fn();
    uniform3fv: Mock<GL['uniform3fv']> = vi.fn();
    uniform3i: Mock<GL['uniform3i']> = vi.fn();
    uniform3iv: Mock<GL['uniform3iv']> = vi.fn();
    uniform4f: Mock<GL['uniform4f']> = vi.fn();
    uniform4fv: Mock<GL['uniform4fv']> = vi.fn();
    uniform4i: Mock<GL['uniform4i']> = vi.fn();
    uniform4iv: Mock<GL['uniform4iv']> = vi.fn();
    uniformMatrix2fv: Mock<GL['uniformMatrix2fv']> = vi.fn();
    uniformMatrix3fv: Mock<GL['uniformMatrix3fv']> = vi.fn();
    uniformMatrix4fv: Mock<GL['uniformMatrix4fv']> = vi.fn();
    useProgram: Mock<GL['useProgram']> = vi.fn();
    validateProgram: Mock<GL['validateProgram']> = vi.fn();
    vertexAttrib1f: Mock<GL['vertexAttrib1f']> = vi.fn();
    vertexAttrib1fv: Mock<GL['vertexAttrib1fv']> = vi.fn();
    vertexAttrib2f: Mock<GL['vertexAttrib2f']> = vi.fn();
    vertexAttrib2fv: Mock<GL['vertexAttrib2fv']> = vi.fn();
    vertexAttrib3f: Mock<GL['vertexAttrib3f']> = vi.fn();
    vertexAttrib3fv: Mock<GL['vertexAttrib3fv']> = vi.fn();
    vertexAttrib4f: Mock<GL['vertexAttrib4f']> = vi.fn();
    vertexAttrib4fv: Mock<GL['vertexAttrib4fv']> = vi.fn();
    vertexAttribPointer: Mock<GL['vertexAttribPointer']> = vi.fn();
    viewport: Mock<GL['viewport']> = vi.fn();
}

/**
 * Create a NullWebGL2RenderingContext suitable for use with maplibre's Context class.
 */
export function createNullGL(): WebGL2RenderingContext {
    const c = document.createElement('canvas');
    return new NullWebGL2RenderingContext(c) as unknown as WebGL2RenderingContext;
}

type BlendFuncConstant = WebGLRenderingContextBase['ZERO'] | WebGLRenderingContextBase['ONE'] | WebGLRenderingContextBase['SRC_COLOR'] | WebGLRenderingContextBase['ONE_MINUS_SRC_COLOR'] | WebGLRenderingContextBase['DST_COLOR'] | WebGLRenderingContextBase['ONE_MINUS_DST_COLOR'] | WebGLRenderingContextBase['SRC_ALPHA'] | WebGLRenderingContextBase['ONE_MINUS_SRC_ALPHA'] | WebGLRenderingContextBase['DST_ALPHA'] | WebGLRenderingContextBase['ONE_MINUS_DST_ALPHA'] | WebGLRenderingContextBase['CONSTANT_COLOR'] | WebGLRenderingContextBase['ONE_MINUS_CONSTANT_COLOR'] | WebGLRenderingContextBase['CONSTANT_ALPHA'] | WebGLRenderingContextBase['ONE_MINUS_CONSTANT_ALPHA'] | WebGLRenderingContextBase['BLEND_COLOR'];

export type BlendFuncType = [BlendFuncConstant, BlendFuncConstant];

export type BlendEquationType = WebGLRenderingContextBase['FUNC_ADD'] | WebGLRenderingContextBase['FUNC_SUBTRACT'] | WebGLRenderingContextBase['FUNC_REVERSE_SUBTRACT'];

export type ColorMaskType = [boolean, boolean, boolean, boolean];

export type CompareFuncType = WebGLRenderingContextBase['NEVER'] | WebGLRenderingContextBase['LESS'] | WebGLRenderingContextBase['EQUAL'] | WebGLRenderingContextBase['LEQUAL'] | WebGLRenderingContextBase['GREATER'] | WebGLRenderingContextBase['NOTEQUAL'] | WebGLRenderingContextBase['GEQUAL'] | WebGLRenderingContextBase['ALWAYS'];

export type DepthMaskType = boolean;

export type DepthRangeType = [number, number];

export type DepthFuncType = CompareFuncType;

export type StencilFuncType = {
    func: CompareFuncType;
    ref: number;
    mask: number;
};

export type StencilOpConstant = WebGLRenderingContextBase['KEEP'] | WebGLRenderingContextBase['ZERO'] | WebGLRenderingContextBase['REPLACE'] | WebGLRenderingContextBase['INCR'] | WebGLRenderingContextBase['INCR_WRAP'] | WebGLRenderingContextBase['DECR'] | WebGLRenderingContextBase['DECR_WRAP'] | WebGLRenderingContextBase['INVERT'];

export type StencilOpType = [StencilOpConstant, StencilOpConstant, StencilOpConstant];

export type TextureUnitType = number;

export type ViewportType = [number, number, number, number];

export type StencilTestGL = {
    func: WebGLRenderingContextBase['NEVER'];
    mask: 0;
} | {
    func: WebGLRenderingContextBase['LESS'];
    mask: number;
} | {
    func: WebGLRenderingContextBase['EQUAL'];
    mask: number;
} | {
    func: WebGLRenderingContextBase['LEQUAL'];
    mask: number;
} | {
    func: WebGLRenderingContextBase['GREATER'];
    mask: number;
} | {
    func: WebGLRenderingContextBase['NOTEQUAL'];
    mask: number;
} | {
    func: WebGLRenderingContextBase['GEQUAL'];
    mask: number;
} | {
    func: WebGLRenderingContextBase['ALWAYS'];
    mask: 0;
};

export type CullFaceModeType = WebGLRenderingContextBase['FRONT'] | WebGLRenderingContextBase['BACK'] | WebGLRenderingContextBase['FRONT_AND_BACK'];

export type FrontFaceType = WebGLRenderingContextBase['CW'] | WebGLRenderingContextBase['CCW'];

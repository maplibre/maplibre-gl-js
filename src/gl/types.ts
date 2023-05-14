type BlendFuncConstant = typeof WebGL2RenderingContext.ZERO | typeof WebGL2RenderingContext.ONE | typeof WebGL2RenderingContext.SRC_COLOR | typeof WebGL2RenderingContext.ONE_MINUS_SRC_COLOR | typeof WebGL2RenderingContext.DST_COLOR | typeof WebGL2RenderingContext.ONE_MINUS_DST_COLOR | typeof WebGL2RenderingContext.SRC_ALPHA | typeof WebGL2RenderingContext.ONE_MINUS_SRC_ALPHA | typeof WebGL2RenderingContext.DST_ALPHA | typeof WebGL2RenderingContext.ONE_MINUS_DST_ALPHA | typeof WebGL2RenderingContext.CONSTANT_COLOR | typeof WebGL2RenderingContext.ONE_MINUS_CONSTANT_COLOR | typeof WebGL2RenderingContext.CONSTANT_ALPHA | typeof WebGL2RenderingContext.ONE_MINUS_CONSTANT_ALPHA | typeof WebGL2RenderingContext.BLEND_COLOR;

export type BlendFuncType = [BlendFuncConstant, BlendFuncConstant];

export type BlendEquationType = typeof WebGL2RenderingContext.FUNC_ADD | typeof WebGL2RenderingContext.FUNC_SUBTRACT | typeof WebGL2RenderingContext.FUNC_REVERSE_SUBTRACT;

export type ColorMaskType = [boolean, boolean, boolean, boolean];

export type CompareFuncType = typeof WebGL2RenderingContext.NEVER | typeof WebGL2RenderingContext.LESS | typeof WebGL2RenderingContext.EQUAL | typeof WebGL2RenderingContext.LEQUAL | typeof WebGL2RenderingContext.GREATER | typeof WebGL2RenderingContext.NOTEQUAL | typeof WebGL2RenderingContext.GEQUAL | typeof WebGL2RenderingContext.ALWAYS;

export type DepthMaskType = boolean;

export type DepthRangeType = [number, number];

export type DepthFuncType = CompareFuncType;

export type StencilFuncType = {
    func: CompareFuncType;
    ref: number;
    mask: number;
};

export type StencilOpConstant = typeof WebGL2RenderingContext.KEEP | typeof WebGL2RenderingContext.ZERO | typeof WebGL2RenderingContext.REPLACE | typeof WebGL2RenderingContext.INCR | typeof WebGL2RenderingContext.INCR_WRAP | typeof WebGL2RenderingContext.DECR | typeof WebGL2RenderingContext.DECR_WRAP | typeof WebGL2RenderingContext.INVERT;

export type StencilOpType = [StencilOpConstant, StencilOpConstant, StencilOpConstant];

export type TextureUnitType = number;

export type ViewportType = [number, number, number, number];

export type StencilTestGL = {
    func: typeof WebGL2RenderingContext.NEVER;
    mask: 0;
} | {
    func: typeof WebGL2RenderingContext.LESS;
    mask: number;
} | {
    func: typeof WebGL2RenderingContext.EQUAL;
    mask: number;
} | {
    func: typeof WebGL2RenderingContext.LEQUAL;
    mask: number;
} | {
    func: typeof WebGL2RenderingContext.GREATER;
    mask: number;
} | {
    func: typeof WebGL2RenderingContext.NOTEQUAL;
    mask: number;
} | {
    func: typeof WebGL2RenderingContext.GEQUAL;
    mask: number;
} | {
    func: typeof WebGL2RenderingContext.ALWAYS;
    mask: 0;
};

export type CullFaceModeType = typeof WebGL2RenderingContext.FRONT | typeof WebGL2RenderingContext.BACK | typeof WebGL2RenderingContext.FRONT_AND_BACK;

export type FrontFaceType = typeof WebGL2RenderingContext.CW | typeof WebGL2RenderingContext.CCW;

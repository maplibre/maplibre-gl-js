import {ClearColor, ClearDepth, ClearStencil, ColorMask, DepthMask, StencilMask, StencilFunc, StencilOp, StencilTest, DepthRange, DepthTest, DepthFunc, Blend, BlendFunc, BlendColor, ProgramValue, ActiveTextureUnit, Viewport, BindFramebuffer, BindRenderbuffer, BindTexture, BindVertexBuffer, BindElementBuffer, BindVertexArray, PixelStoreUnpack, PixelStoreUnpackPremultiplyAlpha} from './value';
import {Context} from './context';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {deepEqual} from '../util/util';
import gl from 'gl';
import {setupMockWebGLContext} from '../util/test/mock_webgl';

const context = new Context(gl(10, 10) as any);

setupMockWebGLContext(context.gl);

const valueTest = (Constructor: new (...args:any[]) => any, options) => {
    test('#constructor', () => {
        const v = new Constructor(context);
        expect(v).toBeTruthy();
        const currentV = v.get();
        expect(typeof currentV).not.toBe('undefined');
    });

    test('#set', () => {
        const v = new Constructor(context);
        v.set(options.setValue);
        const equality = (options.equality) || ((a, b) => deepEqual(a, b));
        expect(equality(v.get(), options.setValue)).toBeTruthy();
    });

};

describe('ClearColor', () => {
    valueTest(ClearColor, {
        setValue: new Color(1, 1, 0, 1)
    });
});

describe('ClearDepth', () => {
    valueTest(ClearDepth, {
        setValue: 0.5
    });
});

describe('ClearStencil', () => {
    valueTest(ClearStencil, {
        setValue: 0.5
    });
});

describe('ColorMask', () => {
    valueTest(ColorMask, {
        setValue: [false, false, true, true]
    });
});

describe('DepthMask', () => {
    valueTest(DepthMask, {
        setValue: false
    });
});

describe('StencilMask', () => {
    valueTest(StencilMask, {
        setValue: [0x00, 4]
    });
});

describe('StencilFunc', () => {
    valueTest(StencilFunc, {
        setValue: {
            func: context.gl.LEQUAL,
            ref: 1,
            mask: 0xFF
        }
    });
});

describe('StencilOp', () => {
    valueTest(StencilOp, {
        setValue: [context.gl.KEEP, context.gl.REPLACE, context.gl.REPLACE]
    });
});

describe('StencilTest', () => {
    valueTest(StencilTest, {
        setValue: true
    });
});

describe('DepthRange', () => {
    valueTest(DepthRange, {
        setValue: [0, 0.1]
    });
});

describe('DepthTest', () => {
    valueTest(DepthTest, {
        setValue: true
    });
});

describe('DepthFunc', () => {
    valueTest(DepthFunc, {
        setValue: context.gl.EQUAL
    });
});

describe('Blend', () => {
    valueTest(Blend, {
        setValue: false
    });
});

describe('BlendFunc', () => {
    valueTest(BlendFunc, {
        setValue: [context.gl.SRC_ALPHA, context.gl.SRC_ALPHA]
    });
});

describe('BlendColor', () => {
    valueTest(BlendColor, {
        setValue: Color.white
    });
});

describe('Program', () => {
    valueTest(ProgramValue, {
        equality: (a, b) => a === b,
        setValue: context.gl.createProgram()
    });
});

describe('ActiveTextureUnit', () => {
    valueTest(ActiveTextureUnit, {
        setValue: context.gl.TEXTURE1
    });
});

describe('Viewport', () => {
    valueTest(Viewport, {
        setValue: [0, 0, 1, 1]
    });
});

describe('BindFramebuffer', () => {
    valueTest(BindFramebuffer, {
        equality: (a, b) => a === b,
        setValue: context.gl.createFramebuffer()
    });
});

describe('BindRenderbuffer', () => {
    valueTest(BindRenderbuffer, {
        equality: (a, b) => a === b,
        setValue: context.gl.createRenderbuffer()
    });
});

describe('BindTexture', () => {
    valueTest(BindTexture, {
        equality: (a, b) => a === b,
        setValue: context.gl.createTexture()
    });
});

describe('BindVertexBuffer', () => {
    valueTest(BindVertexBuffer, {
        equality: (a, b) => a === b,
        setValue: context.gl.createBuffer()
    });
});

describe('BindElementBuffer', () => {
    valueTest(BindElementBuffer, {
        equality: (a, b) => a === b,
        setValue: context.gl.createBuffer()
    });
});

describe('BindVertexArray', () => {
    valueTest(BindVertexArray, {
        equality: (a, b) => a === b,
        setValue: context.createVertexArray()
    });
});

describe('PixelStoreUnpack', () => {
    valueTest(PixelStoreUnpack, {
        setValue: 8
    });
});

describe('PixelStoreUnpackPremultiplyAlpha', () => {
    valueTest(PixelStoreUnpackPremultiplyAlpha, {
        setValue: true
    });
});

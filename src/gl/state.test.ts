import {describe, test, expect} from 'vitest';
import {type IValue, ClearColor, ClearDepth, ClearStencil, ColorMask, DepthMask, StencilMask, StencilFunc, StencilOp, StencilTest, DepthRange, DepthTest, DepthFunc, Blend, BlendFunc, BlendColor, ProgramValue, ActiveTextureUnit, Viewport, BindFramebuffer, BindRenderbuffer, BindTexture, BindVertexBuffer, BindElementBuffer, BindVertexArray, PixelStoreUnpack, PixelStoreUnpackPremultiplyAlpha} from './value';
import {Context} from './context';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {deepEqual} from '../util/util';

describe('Value classes', () => {

    const gl = document.createElement('canvas').getContext('webgl') as WebGL2RenderingContext;
    // Remove when https://github.com/Adamfsk/jest-webgl-canvas-mock/pull/5 is merged
    gl.createVertexArray = gl.getExtension('OES_vertex_array_object')?.createVertexArrayOES;
    gl.bindVertexArray = gl.getExtension('OES_vertex_array_object')?.bindVertexArrayOES;
    const context = new Context(gl);

    const valueTest = <T>(Constructor: new (...args:any[]) => IValue<T>,
        options: {
            setValue: T;
            equality?: (a: T, b: T) => boolean;
        }
    ) => {
        test('constructor', () => {
            const v = new Constructor(context);
            expect(v).toBeTruthy();
            const currentV = v.get();
            expect(typeof currentV).not.toBe('undefined');
        });

        test('set', () => {
            const v = new Constructor(context);
            v.set(options.setValue);
            const equality = (options.equality) || ((a, b) => deepEqual(a, b));
            expect(equality(v.get(), options.setValue)).toBeTruthy();
        });
    };

    valueTest(ClearColor, {
        setValue: new Color(1, 1, 0, 1)
    });
    valueTest(ClearDepth, {
        setValue: 0.5
    });
    valueTest(ClearStencil, {
        setValue: 0.5
    });

    valueTest(ColorMask, {
        setValue: [false, false, true, true]
    });
    valueTest(DepthMask, {
        setValue: false
    });
    valueTest(StencilMask, {
        setValue: 0x00
    });
    valueTest(StencilFunc, {
        setValue: {
            func: context.gl.LEQUAL,
            ref: 1,
            mask: 0xFF
        }
    });
    valueTest(StencilOp, {
        setValue: [context.gl.KEEP, context.gl.REPLACE, context.gl.REPLACE]
    });
    valueTest(StencilTest, {
        setValue: true
    });
    valueTest(DepthRange, {
        setValue: [0, 0.1]
    });
    valueTest(DepthTest, {
        setValue: true
    });
    valueTest(DepthFunc, {
        setValue: context.gl.EQUAL
    });
    valueTest(Blend, {
        setValue: false
    });
    valueTest(BlendFunc, {
        setValue: [context.gl.SRC_ALPHA, context.gl.SRC_ALPHA]
    });
    valueTest(BlendColor, {
        setValue: Color.white
    });
    valueTest(ProgramValue, {
        equality: (a, b) => a === b,
        setValue: context.gl.createProgram()
    });
    valueTest(ActiveTextureUnit, {
        setValue: context.gl.TEXTURE1
    });
    valueTest(Viewport, {
        setValue: [0, 0, 1, 1]
    });
    valueTest(BindFramebuffer, {
        equality: (a, b) => a === b,
        setValue: context.gl.createFramebuffer()
    });
    valueTest(BindRenderbuffer, {
        equality: (a, b) => a === b,
        setValue: context.gl.createRenderbuffer()
    });
    valueTest(BindTexture, {
        equality: (a, b) => a === b,
        setValue: context.gl.createTexture()
    });
    valueTest(BindVertexBuffer, {
        equality: (a, b) => a === b,
        setValue: context.gl.createBuffer()
    });
    valueTest(BindElementBuffer, {
        equality: (a, b) => a === b,
        setValue: context.gl.createBuffer()
    });
    valueTest(BindVertexArray, {
        equality: (a, b) => a === b,
        setValue: context.createVertexArray()
    });
    valueTest(PixelStoreUnpack, {
        setValue: 8
    });
    valueTest(PixelStoreUnpackPremultiplyAlpha, {
        setValue: true
    });
});

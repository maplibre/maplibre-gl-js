import {IndexBuffer} from './index_buffer';

import {VertexBuffer} from './vertex_buffer';
import {Framebuffer} from './framebuffer';
import {DepthMode} from './depth_mode';
import {StencilMode} from './stencil_mode';
import {ColorMode} from './color_mode';
import {CullFaceMode} from './cull_face_mode';
import {deepEqual} from '../util/util';
import {ClearColor, ClearDepth, ClearStencil, ColorMask, DepthMask, StencilMask, StencilFunc, StencilOp, StencilTest, DepthRange, DepthTest, DepthFunc, Blend, BlendFunc, BlendColor, BlendEquation, CullFace, CullFaceSide, FrontFace, ProgramValue, ActiveTextureUnit, Viewport, BindFramebuffer, BindRenderbuffer, BindTexture, BindVertexBuffer, BindElementBuffer, BindVertexArray, PixelStoreUnpack, PixelStoreUnpackPremultiplyAlpha, PixelStoreUnpackFlipY} from './value';

import type {TriangleIndexArray, LineIndexArray, LineStripIndexArray} from '../data/index_array_type';
import type {
    StructArray,
    StructArrayMember
} from '../util/struct_array';
import type {Color} from '@maplibre/maplibre-gl-style-spec';
import {isWebGL2} from './webgl2';

type ClearArgs = {
    color?: Color;
    depth?: number;
    stencil?: number;
};

/**
 * @internal
 * A webgl wrapper class to allow injection, mocking and abstaction
 */
export class Context {
    gl: WebGLRenderingContext | WebGL2RenderingContext;

    currentNumAttributes: number;
    maxTextureSize: number;

    clearColor: ClearColor;
    clearDepth: ClearDepth;
    clearStencil: ClearStencil;
    colorMask: ColorMask;
    depthMask: DepthMask;
    stencilMask: StencilMask;
    stencilFunc: StencilFunc;
    stencilOp: StencilOp;
    stencilTest: StencilTest;
    depthRange: DepthRange;
    depthTest: DepthTest;
    depthFunc: DepthFunc;
    blend: Blend;
    blendFunc: BlendFunc;
    blendColor: BlendColor;
    blendEquation: BlendEquation;
    cullFace: CullFace;
    cullFaceSide: CullFaceSide;
    frontFace: FrontFace;
    program: ProgramValue;
    activeTexture: ActiveTextureUnit;
    viewport: Viewport;
    bindFramebuffer: BindFramebuffer;
    bindRenderbuffer: BindRenderbuffer;
    bindTexture: BindTexture;
    bindVertexBuffer: BindVertexBuffer;
    bindElementBuffer: BindElementBuffer;
    bindVertexArray: BindVertexArray;
    pixelStoreUnpack: PixelStoreUnpack;
    pixelStoreUnpackPremultiplyAlpha: PixelStoreUnpackPremultiplyAlpha;
    pixelStoreUnpackFlipY: PixelStoreUnpackFlipY;

    // eslint-disable-next-line camelcase
    extTextureFilterAnisotropic: EXT_texture_filter_anisotropic | null;
    extTextureFilterAnisotropicMax?: GLfloat;
    HALF_FLOAT?: GLenum;
    RGBA16F?: GLenum;
    RGB16F?: GLenum;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
        this.gl = gl;
        this.clearColor = new ClearColor(this);
        this.clearDepth = new ClearDepth(this);
        this.clearStencil = new ClearStencil(this);
        this.colorMask = new ColorMask(this);
        this.depthMask = new DepthMask(this);
        this.stencilMask = new StencilMask(this);
        this.stencilFunc = new StencilFunc(this);
        this.stencilOp = new StencilOp(this);
        this.stencilTest = new StencilTest(this);
        this.depthRange = new DepthRange(this);
        this.depthTest = new DepthTest(this);
        this.depthFunc = new DepthFunc(this);
        this.blend = new Blend(this);
        this.blendFunc = new BlendFunc(this);
        this.blendColor = new BlendColor(this);
        this.blendEquation = new BlendEquation(this);
        this.cullFace = new CullFace(this);
        this.cullFaceSide = new CullFaceSide(this);
        this.frontFace = new FrontFace(this);
        this.program = new ProgramValue(this);
        this.activeTexture = new ActiveTextureUnit(this);
        this.viewport = new Viewport(this);
        this.bindFramebuffer = new BindFramebuffer(this);
        this.bindRenderbuffer = new BindRenderbuffer(this);
        this.bindTexture = new BindTexture(this);
        this.bindVertexBuffer = new BindVertexBuffer(this);
        this.bindElementBuffer = new BindElementBuffer(this);
        this.bindVertexArray = new BindVertexArray(this);
        this.pixelStoreUnpack = new PixelStoreUnpack(this);
        this.pixelStoreUnpackPremultiplyAlpha = new PixelStoreUnpackPremultiplyAlpha(this);
        this.pixelStoreUnpackFlipY = new PixelStoreUnpackFlipY(this);

        this.extTextureFilterAnisotropic = (
            gl.getExtension('EXT_texture_filter_anisotropic') ||
            gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
            gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
        );

        if (this.extTextureFilterAnisotropic) {
            this.extTextureFilterAnisotropicMax = gl.getParameter(this.extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        }

        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        if (isWebGL2(gl)) {
            this.HALF_FLOAT = gl.HALF_FLOAT;
            const extColorBufferHalfFloat = gl.getExtension('EXT_color_buffer_half_float');
            this.RGBA16F = gl.RGBA16F ?? extColorBufferHalfFloat?.RGBA16F_EXT;
            this.RGB16F = gl.RGB16F ?? extColorBufferHalfFloat?.RGB16F_EXT;
            gl.getExtension('EXT_color_buffer_float');
        } else {
            gl.getExtension('EXT_color_buffer_half_float');
            gl.getExtension('OES_texture_half_float_linear');
            const extTextureHalfFloat = gl.getExtension('OES_texture_half_float');
            this.HALF_FLOAT = extTextureHalfFloat?.HALF_FLOAT_OES;
        }
    }

    setDefault() {
        this.unbindVAO();

        this.clearColor.setDefault();
        this.clearDepth.setDefault();
        this.clearStencil.setDefault();
        this.colorMask.setDefault();
        this.depthMask.setDefault();
        this.stencilMask.setDefault();
        this.stencilFunc.setDefault();
        this.stencilOp.setDefault();
        this.stencilTest.setDefault();
        this.depthRange.setDefault();
        this.depthTest.setDefault();
        this.depthFunc.setDefault();
        this.blend.setDefault();
        this.blendFunc.setDefault();
        this.blendColor.setDefault();
        this.blendEquation.setDefault();
        this.cullFace.setDefault();
        this.cullFaceSide.setDefault();
        this.frontFace.setDefault();
        this.program.setDefault();
        this.activeTexture.setDefault();
        this.bindFramebuffer.setDefault();
        this.pixelStoreUnpack.setDefault();
        this.pixelStoreUnpackPremultiplyAlpha.setDefault();
        this.pixelStoreUnpackFlipY.setDefault();
    }

    setDirty() {
        this.clearColor.dirty = true;
        this.clearDepth.dirty = true;
        this.clearStencil.dirty = true;
        this.colorMask.dirty = true;
        this.depthMask.dirty = true;
        this.stencilMask.dirty = true;
        this.stencilFunc.dirty = true;
        this.stencilOp.dirty = true;
        this.stencilTest.dirty = true;
        this.depthRange.dirty = true;
        this.depthTest.dirty = true;
        this.depthFunc.dirty = true;
        this.blend.dirty = true;
        this.blendFunc.dirty = true;
        this.blendColor.dirty = true;
        this.blendEquation.dirty = true;
        this.cullFace.dirty = true;
        this.cullFaceSide.dirty = true;
        this.frontFace.dirty = true;
        this.program.dirty = true;
        this.activeTexture.dirty = true;
        this.viewport.dirty = true;
        this.bindFramebuffer.dirty = true;
        this.bindRenderbuffer.dirty = true;
        this.bindTexture.dirty = true;
        this.bindVertexBuffer.dirty = true;
        this.bindElementBuffer.dirty = true;
        this.bindVertexArray.dirty = true;
        this.pixelStoreUnpack.dirty = true;
        this.pixelStoreUnpackPremultiplyAlpha.dirty = true;
        this.pixelStoreUnpackFlipY.dirty = true;
    }

    createIndexBuffer(array: TriangleIndexArray | LineIndexArray | LineStripIndexArray, dynamicDraw?: boolean) {
        return new IndexBuffer(this, array, dynamicDraw);
    }

    createVertexBuffer(array: StructArray, attributes: ReadonlyArray<StructArrayMember>, dynamicDraw?: boolean) {
        return new VertexBuffer(this, array, attributes, dynamicDraw);
    }

    createRenderbuffer(storageFormat: number, width: number, height: number) {
        const gl = this.gl;

        const rbo = gl.createRenderbuffer();
        this.bindRenderbuffer.set(rbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, storageFormat, width, height);
        this.bindRenderbuffer.set(null);

        return rbo;
    }

    createFramebuffer(width: number, height: number, hasDepth: boolean, hasStencil: boolean) {
        return new Framebuffer(this, width, height, hasDepth, hasStencil);
    }

    clear({
        color,
        depth,
        stencil
    }: ClearArgs) {
        const gl = this.gl;
        let mask = 0;

        if (color) {
            mask |= gl.COLOR_BUFFER_BIT;
            this.clearColor.set(color);
            this.colorMask.set([true, true, true, true]);
        }

        if (typeof depth !== 'undefined') {
            mask |= gl.DEPTH_BUFFER_BIT;

            // Workaround for platforms where clearDepth doesn't seem to work
            // without resetting the depthRange. See https://github.com/mapbox/mapbox-gl-js/issues/3437
            this.depthRange.set([0, 1]);

            this.clearDepth.set(depth);
            this.depthMask.set(true);
        }

        if (typeof stencil !== 'undefined') {
            mask |= gl.STENCIL_BUFFER_BIT;
            this.clearStencil.set(stencil);
            this.stencilMask.set(0xFF);
        }

        gl.clear(mask);
    }

    setCullFace(cullFaceMode: Readonly<CullFaceMode>) {
        if (cullFaceMode.enable === false) {
            this.cullFace.set(false);
        } else {
            this.cullFace.set(true);
            this.cullFaceSide.set(cullFaceMode.mode);
            this.frontFace.set(cullFaceMode.frontFace);
        }
    }

    setDepthMode(depthMode: Readonly<DepthMode>) {
        if (depthMode.func === this.gl.ALWAYS && !depthMode.mask) {
            this.depthTest.set(false);
        } else {
            this.depthTest.set(true);
            this.depthFunc.set(depthMode.func);
            this.depthMask.set(depthMode.mask);
            this.depthRange.set(depthMode.range);
        }
    }

    setStencilMode(stencilMode: Readonly<StencilMode>) {
        if (stencilMode.test.func === this.gl.ALWAYS && !stencilMode.mask) {
            this.stencilTest.set(false);
        } else {
            this.stencilTest.set(true);
            this.stencilMask.set(stencilMode.mask);
            this.stencilOp.set([stencilMode.fail, stencilMode.depthFail, stencilMode.pass]);
            this.stencilFunc.set({
                func: stencilMode.test.func,
                ref: stencilMode.ref,
                mask: stencilMode.test.mask
            });
        }
    }

    setColorMode(colorMode: Readonly<ColorMode>) {
        if (deepEqual(colorMode.blendFunction, ColorMode.Replace)) {
            this.blend.set(false);
        } else {
            this.blend.set(true);
            this.blendFunc.set(colorMode.blendFunction);
            this.blendColor.set(colorMode.blendColor);
        }

        this.colorMask.set(colorMode.mask);
    }

    createVertexArray(): WebGLVertexArrayObject | undefined {
        if (isWebGL2(this.gl))
            return this.gl.createVertexArray();
        return this.gl.getExtension('OES_vertex_array_object')?.createVertexArrayOES();
    }

    deleteVertexArray(x: WebGLVertexArrayObject | undefined) {
        if (isWebGL2(this.gl))
            return this.gl.deleteVertexArray(x);
        return this.gl.getExtension('OES_vertex_array_object')?.deleteVertexArrayOES(x);
    }

    unbindVAO() {
        // Unbinding the VAO prevents other things (custom layers, new buffer creation) from
        // unintentionally changing the state of the last VAO used.
        this.bindVertexArray.set(null);
    }
}

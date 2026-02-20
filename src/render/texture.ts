import type {Context} from '../gl/context';
import type {RGBAImage, AlphaImage} from '../util/image';
import {premultiplyAlpha} from '../util/image';

export type TextureFormat = WebGLRenderingContextBase['RGBA'] | WebGLRenderingContextBase['ALPHA'];
export type TextureFilter = WebGLRenderingContextBase['LINEAR'] | WebGLRenderingContextBase['LINEAR_MIPMAP_NEAREST'] | WebGLRenderingContextBase['NEAREST'];
export type TextureWrap = WebGLRenderingContextBase['REPEAT'] | WebGLRenderingContextBase['CLAMP_TO_EDGE'] | WebGLRenderingContextBase['MIRRORED_REPEAT'];

type EmptyImage = {
    width: number;
    height: number;
    data: null;
};

type DataTextureImage = RGBAImage | AlphaImage | EmptyImage;
export type TextureImage = TexImageSource | DataTextureImage;

function hasDataProperty(image: TextureImage): image is DataTextureImage {
    return 'data' in image;
}

/**
 * @internal
 * A `Texture` GL related object
 */
export class Texture {
    context: Context;
    size: [number, number];
    texture: WebGLTexture;
    format: TextureFormat;
    filter: TextureFilter;
    wrap: TextureWrap;
    useMipmap: boolean;

    /** Tracks the original handle to detect corruption after context loss (#2811) */
    private _ownedHandle: WebGLTexture;

    constructor(context: Context, image: TextureImage, format: TextureFormat, options?: {
        premultiply?: boolean;
        useMipmap?: boolean;
    } | null) {
        this.context = context;
        this.format = format;
        this.texture = context.gl.createTexture();
        this._ownedHandle = this.texture;
        this.update(image, options);
    }

    update(image: TextureImage, options?: {
        premultiply?: boolean;
        useMipmap?: boolean;
    } | null, position?: {
        x: number;
        y: number;
    }) {
        const {width, height} = image as {width: number; height: number};
        const resize = (!this.size || this.size[0] !== width || this.size[1] !== height) && !position;
        const {context} = this;
        const {gl} = context;

        this.useMipmap = Boolean(options && options.useMipmap);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        context.pixelStoreUnpackFlipY.set(false);
        context.pixelStoreUnpack.set(1);

        const wantPremultiply = this.format === gl.RGBA && (!options || options.premultiply !== false);

        if (resize) {
            this.size = [width, height];
            if (hasDataProperty(image)) {
                // #2030: raw data is premultiplied in JS
                context.pixelStoreUnpackPremultiplyAlpha.set(false);
                this._uploadRawData(image, wantPremultiply, width, height, gl);
            } else {
                context.pixelStoreUnpackPremultiplyAlpha.set(wantPremultiply);
                this._uploadDomImage(image, gl);
            }
        } else {
            const {x, y} = position || {x: 0, y: 0};
            if (hasDataProperty(image)) {
                context.pixelStoreUnpackPremultiplyAlpha.set(false);
                this._updateRawData(image, wantPremultiply, x, y, width, height, gl);
            } else {
                context.pixelStoreUnpackPremultiplyAlpha.set(wantPremultiply);
                this._updateDomImage(image, x, y, gl);
            }
        }

        if (this.useMipmap && this.isSizePowerOfTwo()) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }

        context.pixelStoreUnpackFlipY.setDefault();
        context.pixelStoreUnpack.setDefault();
        context.pixelStoreUnpackPremultiplyAlpha.setDefault();
    }

    private _uploadDomImage(image: TexImageSource, gl: WebGLRenderingContext | WebGL2RenderingContext) {
        gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, gl.UNSIGNED_BYTE, image);
    }

    private _uploadRawData(image: DataTextureImage, wantPremultiply: boolean, width: number, height: number, gl: WebGLRenderingContext | WebGL2RenderingContext) {
        let {data} = image;
        if (wantPremultiply && data) data = premultiplyAlpha(data);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, gl.UNSIGNED_BYTE, data);
    }

    private _updateDomImage(image: TexImageSource, x: number, y: number, gl: WebGLRenderingContext | WebGL2RenderingContext) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }

    private _updateRawData(image: DataTextureImage, wantPremultiply: boolean, x: number, y: number, width: number, height: number, gl: WebGLRenderingContext | WebGL2RenderingContext) {
        let {data} = image;
        if (wantPremultiply && data) data = premultiplyAlpha(data);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }

    bind(filter: TextureFilter, wrap: TextureWrap, minFilter?: TextureFilter | null) {
        const {context} = this;
        const {gl} = context;

        if (this.texture !== this._ownedHandle) {
            this.texture = this._ownedHandle;
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (minFilter === gl.LINEAR_MIPMAP_NEAREST && !this.isSizePowerOfTwo()) {
            minFilter = gl.LINEAR;
        }

        if (filter !== this.filter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter || filter);
            this.filter = filter;
        }

        if (wrap !== this.wrap) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
            this.wrap = wrap;
        }
    }

    isSizePowerOfTwo() {
        return this.size[0] === this.size[1] && (Math.log(this.size[0]) / Math.LN2) % 1 === 0;
    }

    destroy() {
        const {gl} = this.context;
        gl.deleteTexture(this.texture);
        this.texture = null;
        this._ownedHandle = null;
    }
}

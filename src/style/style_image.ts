import {type RGBAImage} from '../util/image.ts';

import type {Map} from '../ui/map.ts';

export type SpriteJSON = {[id: string]: StyleImageMetadata & {
    width: number;
    height: number;
    x: number;
    y: number;
};};

/**
 * The sprite data
 */
export type SpriteOnDemandStyleImage = {
    width: number;
    height: number;
    x: number;
    y: number;
    context: CanvasRenderingContext2D;
};

/**
 * The style's image metadata
 */
export type StyleImageData = {
    data: RGBAImage;
    version?: number;
    hasRenderCallback?: boolean;
    isWebGLImage?: boolean;
    userImage?: StyleImageInterface;
    spriteData?: SpriteOnDemandStyleImage;
};

/**
 * Enumeration of possible values for StyleImageMetadata.textFitWidth and textFitHeight.
 */
export const enum TextFit {
    /**
     * The image will be resized on the specified axis to tightly fit the content rectangle to target text.
     * This is the same as not being defined.
     */
    stretchOrShrink = 'stretchOrShrink',
    /**
     * The image will be resized on the specified axis to fit the content rectangle to the target text, but will not
     * fall below the aspect ratio of the original content rectangle if the other axis is set to proportional.
     */
    stretchOnly = 'stretchOnly',
    /**
     * The image will be resized on the specified axis to fit the content rectangle to the target text and
     * will resize the other axis to maintain the aspect ratio of the content rectangle.
     */
    proportional = 'proportional'
}

/**
 * The style's image metadata
 */
export type StyleImageMetadata = {
    /**
     * The ratio of pixels in the image to physical pixels on the screen
     */
    pixelRatio: number;
    /**
     * Whether the image should be interpreted as an SDF image
     */
    sdf: boolean;
    /**
     * If `icon-text-fit` is used in a layer with this image, this option defines the part(s) of the image that can be stretched horizontally.
     */
    stretchX?: Array<[number, number]>;
    /**
     * If `icon-text-fit` is used in a layer with this image, this option defines the part(s) of the image that can be stretched vertically.
     */
    stretchY?: Array<[number, number]>;
    /**
     * If `icon-text-fit` is used in a layer with this image, this option defines the part of the image that can be covered by the content in `text-field`.
     */
    content?: [number, number, number, number];
    /**
     * If `icon-text-fit` is used in a layer with this image, this option defines constraints on the horizontal scaling of the image.
     */
    textFitWidth?: TextFit;
    /**
     * If `icon-text-fit` is used in a layer with this image, this option defines constraints on the vertical scaling of the image.
     */
    textFitHeight?: TextFit;
};

/**
 * the style's image, including data and metedata
 */
export type StyleImage = StyleImageData & StyleImageMetadata;

/**
 * Where a {@link StyleImageWebGLData.renderWithWebGL} callback writes its pixels.
 */
export type StyleImageWebGLTarget = {
    gl: WebGL2RenderingContext;
    /**
     * The icon atlas to write into. MapLibre does not bind it for you, so start with
     * `gl.bindTexture(gl.TEXTURE_2D, texture)` or attach it to your own framebuffer.
     */
    texture: WebGLTexture;
    x: number;
    y: number;
    width: number;
    height: number;
};

/**
 * What a {@link StyleImageInterface} gives as its `data` when it renders itself with WebGL rather
 * than handing over an array of pixels.
 *
 * @see [Animate an icon on the GPU.](https://maplibre.org/maplibre-gl-js/docs/examples/animate-an-icon-on-the-gpu/)
 */
export type StyleImageWebGLData = {
    /**
     * Render exactly `width` x `height` premultiplied-alpha pixels at (`x`, `y`) of
     * `target.texture`. That rectangle is the only part of the shared atlas that belongs to this
     * image; drawing outside it corrupts the others.
     *
     * This is the image's counterpart to {@link CustomLayerInterface.render}, and the context
     * arrives in the same state a custom layer's is given: cull face, active texture and the pixel
     * store settings at their WebGL defaults, and no vertex array bound. Everything is yours to
     * change, and MapLibre restores its own state afterwards. The scissor test is the one
     * exception: MapLibre leaves it disabled rather than restoring it, so an image that enables
     * it has to disable it again.
     *
     * Called before the first frame the image is used in, again whenever
     * {@link StyleImageInterface.render} returns `true`, and again for each atlas holding a slot
     * this image has never rendered into, so one change may mean several calls with different
     * targets.
     */
    renderWithWebGL: (target: StyleImageWebGLTarget) => void;
};

/**
 * Interface for dynamically generated style images. This is a specification for
 * implementers to model: it is not an exported method or class.
 *
 * Images implementing this interface can be redrawn for every frame. They can be used to animate
 * icons and patterns or make them respond to user input. Style images can implement a
 * {@link StyleImageInterface.render} method. The method is called every frame and
 * can be used to update the image.
 *
 * @see [Add an animated icon to the map.](https://maplibre.org/maplibre-gl-js/docs/examples/add-image-animated/)
 *
 * @example
 * ```ts
 * let flashingSquare = {
 *     width: 64,
 *     height: 64,
 *     data: new Uint8Array(64 * 64 * 4),
 *
 *     onAdd: function(map) {
 *         this.map = map;
 *     },
 *
 *     render: function() {
 *         // keep repainting while the icon is on the map
 *         this.map.triggerRepaint();
 *
 *         // alternate between black and white based on the time
 *         let value = Math.round(Date.now() / 1000) % 2 === 0  ? 255 : 0;
 *
 *         // check if image needs to be changed
 *         if (value !== this.previousValue) {
 *             this.previousValue = value;
 *
 *             let bytesPerPixel = 4;
 *             for (let x = 0; x < this.width; x++) {
 *                 for (let y = 0; y < this.height; y++) {
 *                     let offset = (y * this.width + x) * bytesPerPixel;
 *                     this.data[offset + 0] = value;
 *                     this.data[offset + 1] = value;
 *                     this.data[offset + 2] = value;
 *                     this.data[offset + 3] = 255;
 *                 }
 *             }
 *
 *             // return true to indicate that the image changed
 *             return true;
 *         }
 *     }
 *  }
 *
 *  map.addImage('flashing_square', flashingSquare);
 * ```
 */

export interface StyleImageInterface {
    width: number;
    height: number;
    /**
     * The image's pixels, in the same format as `ImageData`, or a {@link StyleImageWebGLData}
     * callback that renders them with WebGL. A WebGL image renders straight into its slot of the
     * shared icon atlas. Nothing new is possible that pixels could not express, but an image that
     * changes often, such as an animated icon, gets much cheaper: no CPU pixel work and no upload.
     */
    data: Uint8Array | Uint8ClampedArray | StyleImageWebGLData;
    /**
     * This method is called once before every frame where the icon will be used.
     * The method can optionally update the image's `data` member with a new image.
     *
     * If the method updates the image it must return `true` to commit the change.
     * If the method returns `false` or nothing the image is assumed to not have changed.
     *
     * An animated image schedules its next frame by calling {@link Map.triggerRepaint}, typically
     * from a timer; returning `false` in between lets the map rest and fire `idle`.
     *
     * An image whose `data` renders with WebGL has nothing to update here; returning `true` is how
     * it asks for {@link StyleImageWebGLData.renderWithWebGL} to be called again.
     *
     * If updates are infrequent it maybe easier to use {@link Map.updateImage} to update
     * the image instead of implementing this method.
     *
     * @returns `true` if this method updated the image. `false` if the image was not changed.
     */
    render?: () => boolean;
    /**
     * Optional method called when the layer has been added to the Map with {@link Map.addImage}.
     *
     * @param map - The Map this custom layer was just added to.
     */
    onAdd?: (map: Map, id: string) => void;
    /**
     * Optional method called when the icon is removed from the map with {@link Map.removeImage}.
     * This gives the image a chance to clean up resources and event listeners.
     *
     * This also fires when the WebGL context is lost, after which the same image is added back
     * without a matching `onAdd`, so the image has to be able to build again whatever it
     * released here.
     */
    onRemove?: () => void;
}

export function isStyleImageWebGLData(data: StyleImageInterface['data']): data is StyleImageWebGLData {
    return typeof (data as StyleImageWebGLData)?.renderWithWebGL === 'function';
}

export function renderStyleImage(image: StyleImage): boolean {
    const {userImage} = image;
    if (!userImage?.render) return false;
    const updated = userImage.render();
    if (!updated) return false;

    if (!isStyleImageWebGLData(userImage.data)) image.data.replace(new Uint8Array(userImage.data.buffer));
    return true;
}

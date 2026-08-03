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
    isCustomImage?: boolean;
    userImage?: StyleImageInterface | CustomStyleImageInterface;
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
 * Where a {@link CustomStyleImageInterface} writes its pixels. The texture is shared with
 * other images, so only the rectangle described here belongs to this image.
 */
export type StyleImageRenderTarget = {
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
 * What a {@link CustomStyleImageInterface} is given when it is added to a map.
 */
export type StyleImageContext = {
    map: Map;
    /** The ID the image was added under with {@link Map.addImage}. */
    id: string;
    /**
     * Ask for this image to be drawn again. {@link CustomStyleImageInterface.render} is called
     * before the next frame, and a frame is scheduled. This is the only way an image is marked
     * as changed: call it from a timer, an event, or from `render` itself for an image that
     * animates on every frame.
     *
     * Once the image has been removed from the map this does nothing, so a timer that outlives
     * {@link Map.removeImage} can neither bring the image back nor disturb whatever was added
     * under its ID next.
     */
    invalidate: () => void;
};

/**
 * Interface for a style image that draws itself with WebGL, for {@link Map.addImage}. This is a
 * specification for implementers to model: it is not an exported method or class.
 *
 * Unlike {@link StyleImageInterface}, which hands MapLibre an array of pixels to upload, a
 * custom image draws straight into its slot of the shared icon atlas. Nothing new is possible
 * that `render` could not already do, but an image that changes often, such as an animated
 * icon, gets much cheaper: no CPU pixel work and no upload.
 *
 * @see [Animate an icon on the GPU.](https://maplibre.org/maplibre-gl-js/docs/examples/animate-an-icon-on-the-gpu/)
 */
export interface CustomStyleImageInterface {
    type: 'custom';
    width: number;
    height: number;
    /**
     * Draw this image. Called before the first frame it is used in, again whenever
     * {@link StyleImageContext.invalidate} has been called, and again whenever a slot this image
     * has never painted is packed into an atlas.
     *
     * Draw exactly `width` x `height` premultiplied-alpha pixels at (`x`, `y`) of
     * `target.texture`. Drawing outside that rectangle corrupts other images. MapLibre restores
     * its own WebGL state afterwards, so bindings, framebuffers and pixel store settings are
     * yours to change.
     *
     * An image can sit in more than one atlas, so one change may call this several times with a
     * different `target`.
     */
    render: (target: StyleImageRenderTarget) => void;
    /**
     * Optional method called when the image has been added to the Map with {@link Map.addImage}.
     *
     * @param context - The map this image was added to, its ID, and the callback that asks for
     * it to be drawn again.
     */
    onAdd?: (context: StyleImageContext) => void;
    /**
     * Optional method called when the image is removed from the map with
     * {@link Map.removeImage}. This gives the image a chance to release its GPU resources.
     *
     * This also fires when the WebGL context is lost, after which the same image is added back
     * without a matching `onAdd`, so anything released here has to be recreatable from
     * {@link CustomStyleImageInterface.render}.
     */
    onRemove?: () => void;
}

/**
 * Interface for dynamically generated style images. This is a specification for
 * implementers to model: it is not an exported method or class.
 *
 * Images implementing this interface can be redrawn for every frame. They can be used to animate
 * icons and patterns or make them respond to user input. Style images can implement a
 * {@link StyleImageInterface.render} method. The method is called every frame and
 * can be used to update the image.
 *
 * An image that draws itself with WebGL rather than handing over an array of pixels implements
 * {@link CustomStyleImageInterface} instead.
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
    data: Uint8Array | Uint8ClampedArray;
    /**
     * This method is called once before every frame where the icon will be used.
     * The method can optionally update the image's `data` member with a new image.
     *
     * If the method updates the image it must return `true` to commit the change.
     * If the method returns `false` or nothing the image is assumed to not have changed.
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
     */
    onRemove?: () => void;
}

export function isCustomStyleImage(image: StyleImageInterface | CustomStyleImageInterface): image is CustomStyleImageInterface {
    return (image as CustomStyleImageInterface)?.type === 'custom';
}

export function renderStyleImage(image: StyleImage): boolean {
    const {userImage} = image;
    if (!isCustomStyleImage(userImage) && userImage?.render?.()) {
        image.data.replace(new Uint8Array(userImage.data.buffer));
        return true;
    }
    return false;
}

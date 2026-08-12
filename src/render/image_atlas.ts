/* eslint-disable key-spacing */
import {RGBAImage} from '../util/image.ts';
import {register} from '../util/web_worker_transfer.ts';
import {isStyleImageWebGLData} from '../style/style_image.ts';
import potpack from 'potpack';

import type {StyleImage} from '../style/style_image.ts';
import {type TextFit} from '../style/style_image.ts';
import type {ImageManager} from './image_manager.ts';
import type {Texture} from '../webgl/texture.ts';
import type {Rect} from './glyph_atlas.ts';
import type {GetImagesResponse} from '../util/actor_messages.ts';

const IMAGE_PADDING: number = 1;
export {IMAGE_PADDING};

export class ImagePosition {
    paddedRect: Rect;
    pixelRatio: number;
    version: number;
    needsFirstWebGLRender: boolean;
    stretchY: Array<[number, number]>;
    stretchX: Array<[number, number]>;
    content: [number, number, number, number];
    textFitWidth: TextFit;
    textFitHeight: TextFit;

    constructor(paddedRect: Rect, {
        pixelRatio,
        version,
        isWebGLImage = false,
        stretchX,
        stretchY,
        content,
        textFitWidth,
        textFitHeight
    }: StyleImage) {
        this.paddedRect = paddedRect;
        this.pixelRatio = pixelRatio;
        this.stretchX = stretchX;
        this.stretchY = stretchY;
        this.content = content;
        this.version = version;
        this.needsFirstWebGLRender = isWebGLImage;
        this.textFitWidth = textFitWidth;
        this.textFitHeight = textFitHeight;
    }

    get tl(): [number, number] {
        return [
            this.paddedRect.x + IMAGE_PADDING,
            this.paddedRect.y + IMAGE_PADDING
        ];
    }

    get br(): [number, number] {
        return [
            this.paddedRect.x + this.paddedRect.w - IMAGE_PADDING,
            this.paddedRect.y + this.paddedRect.h - IMAGE_PADDING
        ];
    }

    get tlbr(): number[] {
        return this.tl.concat(this.br);
    }

    get displaySize(): [number, number] {
        return [
            (this.paddedRect.w - IMAGE_PADDING * 2) / this.pixelRatio,
            (this.paddedRect.h - IMAGE_PADDING * 2) / this.pixelRatio
        ];
    }
}

/**
 * A single tile's packed copy of the icons and patterns its features reference, built in the
 * worker so that the symbol layout can bake the positions within it straight into the vertex
 * buffers. Each tile owns one, along with the texture it is uploaded to - as opposed to
 * {@link ImageManager}, which owns the images of the whole style.
 * @internal
 */
export class ImageAtlas {
    image: RGBAImage;
    iconPositions: Record<string, ImagePosition>;
    patternPositions: Record<string, ImagePosition>;
    haveRenderCallbacks: string[];
    uploaded: boolean;
    /**
     * The {@link ImageManager.updateVersion} this atlas' texture was last patched against.
     * Starts out at `-1` so that a freshly transferred atlas always patches once: images may have
     * been updated between the moment the worker snapshotted them and the moment the atlas arrives.
     */
    patchedUpdateVersion: number;

    constructor(icons: GetImagesResponse, patterns: GetImagesResponse) {
        const iconPositions = {}, patternPositions = {};
        this.haveRenderCallbacks = [];
        this.patchedUpdateVersion = -1;

        const bins = [];

        this.addImages(icons, iconPositions, bins);
        this.addImages(patterns, patternPositions, bins);

        const {w, h} = potpack(bins);
        const image = new RGBAImage({width: w || 1, height: h || 1});

        for (const id in icons) {
            const src = icons[id];
            if (src.isWebGLImage) continue;
            const bin = iconPositions[id].paddedRect;
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: bin.x + IMAGE_PADDING, y: bin.y + IMAGE_PADDING}, src.data);
        }

        for (const id in patterns) {
            const src = patterns[id];
            const bin = patternPositions[id].paddedRect;
            const x = bin.x + IMAGE_PADDING,
                y = bin.y + IMAGE_PADDING,
                w = src.data.width,
                h = src.data.height;

            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x, y}, src.data);
            // Add 1 pixel wrapped padding on each side of the image.
            RGBAImage.copy(src.data, image, {x: 0, y: h - 1}, {x, y: y - 1}, {width: w, height: 1}); // T
            RGBAImage.copy(src.data, image, {x: 0, y:     0}, {x, y: y + h}, {width: w, height: 1}); // B
            RGBAImage.copy(src.data, image, {x: w - 1, y: 0}, {x: x - 1, y}, {width: 1, height: h}); // L
            RGBAImage.copy(src.data, image, {x: 0,     y: 0}, {x: x + w, y}, {width: 1, height: h}); // R
        }

        this.image = image;
        this.iconPositions = iconPositions;
        this.patternPositions = patternPositions;
    }

    addImages(images: {[_: string]: StyleImage}, positions: {[_: string]: ImagePosition}, bins: Rect[]): void {
        for (const id in images) {
            const src = images[id];
            const bin = {
                x: 0,
                y: 0,
                w: src.data.width + 2 * IMAGE_PADDING,
                h: src.data.height + 2 * IMAGE_PADDING,
            };
            bins.push(bin);
            positions[id] = new ImagePosition(bin, src);

            if (src.hasRenderCallback) {
                this.haveRenderCallbacks.push(id);
            }
        }
    }

    /**
     * Brings this atlas' texture back in sync with the images it was built from, re-uploading the
     * ones that were replaced in the meantime.
     *
     * This runs for every in-view tile on every frame, so the common case of nothing having
     * changed has to cost nothing: a single comparison against {@link ImageManager.updateVersion}
     * ends the call. When something did change, only the images this atlas actually holds are
     * looked at - a handful per tile - and {@link ImageAtlas.patchUpdatedImage} then skips the
     * ones whose version still matches, leaving just the genuinely stale ones to upload.
     *
     * The render callbacks are dispatched first because they may update images themselves, and
     * those updates have to be part of the version this call catches up with - otherwise an
     * animated image would always be uploaded a frame late.
     */
    patchUpdatedImages(imageManager: ImageManager, texture: Texture): void {
        imageManager.dispatchRenderCallbacks(this.haveRenderCallbacks);

        if (this.patchedUpdateVersion === imageManager.updateVersion) return;
        this.patchedUpdateVersion = imageManager.updateVersion;

        for (const name in this.iconPositions) {
            this.patchUpdatedImage(this.iconPositions[name], imageManager.getImage(name), texture);
        }
        for (const name in this.patternPositions) {
            this.patchUpdatedImage(this.patternPositions[name], imageManager.getImage(name), texture);
        }
    }

    patchUpdatedImage(position: ImagePosition, image: StyleImage, texture: Texture): void {
        if (!position || !image) return;

        if (!position.needsFirstWebGLRender && position.version === image.version) return;

        position.needsFirstWebGLRender = false;
        position.version = image.version;
        const [x, y] = position.tl;
        const data = image.userImage?.data;
        if (!isStyleImageWebGLData(data)) {
            texture.update(image.data, undefined, {x, y});
            return;
        }

        const {width, height} = image.data;
        texture.context.setCustomLayerDefaults();
        data.renderWithWebGL({gl: texture.context.gl, texture: texture.texture, x, y, width, height});
        texture.context.setDirty();
    }

}

register('ImagePosition', ImagePosition);
register('ImageAtlas', ImageAtlas);

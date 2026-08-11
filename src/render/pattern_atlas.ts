/* eslint-disable key-spacing */
import potpack from 'potpack';

import {RGBAImage} from '../util/image.ts';
import {ImagePosition} from './image_atlas.ts';
import {Texture} from '../webgl/texture.ts';

import type {ImageManager} from './image_manager.ts';
import type {StyleImage} from '../style/style_image.ts';
import type {Context} from '../webgl/context.ts';
import type {PotpackBox} from 'potpack';

type Pattern = {
    bin: PotpackBox;
    position: ImagePosition;
    /**
     * The image this entry was packed from. Kept to notice when an image was removed and added
     * again under the same id, in which case the entry has to be rebuilt even though the version
     * of the new image may happen to match the one of the old.
     */
    image: StyleImage;
};

/**
 * When copied into the atlas texture, pattern images are padded by one pixel on each side with a
 * copy of the image data wrapped from the opposite side. This ensures the correct behavior of
 * GL_LINEAR texture sampling mode.
 */
const PADDING = 1;

/**
 * A texture atlas of the pattern images that are drawn without a tile's own {@link ImageAtlas},
 * i.e. `background-pattern`. Entries are packed on demand and re-packed whenever one of them is
 * added or changes, which is rare enough for the repacking cost not to matter.
 */
export class PatternAtlas {
    private _imageManager: ImageManager;
    private _entries: Record<string, Pattern>;
    private _image: RGBAImage;
    private _texture: Texture;
    private _dirty: boolean;

    constructor(imageManager: ImageManager) {
        this._imageManager = imageManager;
        this._entries = {};
        this._image = new RGBAImage({width: 1, height: 1});
        this._dirty = true;
    }

    destroy(): void {
        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }

        this._entries = {};
        this._image = new RGBAImage({width: 1, height: 1});
        this._dirty = true;
    }

    getPixelSize(): {width: number; height: number} {
        const {width, height} = this._image;
        return {width, height};
    }

    /**
     * @returns the position of the pattern within the atlas, or `null` if there is no such image
     */
    getPattern(id: string): ImagePosition {
        const image = this._imageManager.getImage(id);
        if (!image) {
            return null;
        }

        const entry = this._entries[id];
        if (entry?.image !== image) {
            // there is no entry yet, or the image was replaced by another one under the same id,
            // in which case the slot has to be packed anew - the new image may have another size
            const w = image.data.width + PADDING * 2;
            const h = image.data.height + PADDING * 2;
            const bin = {w, h, x: 0, y: 0};
            this._entries[id] = {bin, position: new ImagePosition(bin, image), image};
        } else if (entry.position.version !== image.version) {
            entry.position.version = image.version;
        } else {
            return entry.position;
        }

        this._update();

        return this._entries[id].position;
    }

    bind(context: Context): void {
        const gl = context.gl;
        if (!this._texture) {
            this._texture = new Texture(context, this._image, gl.RGBA);
            this._dirty = false;
        } else if (this._dirty) {
            this._texture.update(this._image);
            this._dirty = false;
        }

        this._texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    private _update(): void {
        // drop the entries whose image is gone - they hold on to a slot of the atlas for nothing
        for (const id in this._entries) {
            if (!this._imageManager.getImage(id)) {
                delete this._entries[id];
            }
        }

        const bins = [];
        for (const id in this._entries) {
            bins.push(this._entries[id].bin);
        }

        const {w, h} = potpack(bins);

        const dst = this._image;
        dst.resize({width: w || 1, height: h || 1});

        for (const id in this._entries) {
            const {bin} = this._entries[id];
            const x = bin.x + PADDING;
            const y = bin.y + PADDING;
            const src = this._entries[id].image.data;
            const w = src.width;
            const h = src.height;

            RGBAImage.copy(src, dst, {x: 0, y: 0}, {x, y}, {width: w, height: h});

            // Add 1 pixel wrapped padding on each side of the image.
            RGBAImage.copy(src, dst, {x: 0, y: h - 1}, {x, y: y - 1}, {width: w, height: 1}); // T
            RGBAImage.copy(src, dst, {x: 0, y:     0}, {x, y: y + h}, {width: w, height: 1}); // B
            RGBAImage.copy(src, dst, {x: w - 1, y: 0}, {x: x - 1, y}, {width: 1, height: h}); // L
            RGBAImage.copy(src, dst, {x: 0,     y: 0}, {x: x + w, y}, {width: 1, height: h}); // R
        }

        this._dirty = true;
    }
}

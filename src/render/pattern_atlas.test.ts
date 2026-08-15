import {describe, expect, test, vi, beforeEach} from 'vitest';
import {ImageManager} from './image_manager.ts';
import {PatternAtlas} from './pattern_atlas.ts';
import {Context} from '../webgl/context.ts';
import {Texture} from '../webgl/texture.ts';
import {createNullGL} from '../util/test/null_gl.ts';
import {RGBAImage} from '../util/image.ts';

import type {StyleImage} from '../style/style_image.ts';

const PADDING_ON_EACH_SIDE = 2;
const sizeInAtlas = (size: number) => ({width: size + PADDING_ON_EACH_SIDE, height: size + PADDING_ON_EACH_SIDE});

function createStyleImage(size: number, fill: number = 0): StyleImage {
    const data = new Uint8Array(size * size * 4).fill(fill);
    return {
        data: new RGBAImage({width: size, height: size}, data),
        pixelRatio: 1,
        sdf: false
    };
}

describe('PatternAtlas', () => {
    let imageManager: ImageManager;
    let patternAtlas: PatternAtlas;
    let context: Context;

    beforeEach(() => {
        vi.restoreAllMocks();
        imageManager = new ImageManager();
        patternAtlas = new PatternAtlas(imageManager);
        context = new Context(createNullGL());
    });

    test('packs an image into a slot padded by one pixel on each side, and keeps handing back its position while it does not change', () => {
        imageManager.addImage('pattern', createStyleImage(4));

        const position = patternAtlas.getPattern('pattern');

        expect(position.displaySize).toEqual([4, 4]);
        expect(patternAtlas.getPixelSize()).toEqual(sizeInAtlas(4));
        expect(patternAtlas.getPattern('pattern')).toBe(position);
    });

    test('re-packs the slot when a sprite reload replaces the image with a bigger one', () => {
        imageManager.addImage('pattern', createStyleImage(4));
        patternAtlas.getPattern('pattern');

        imageManager.updateImage('pattern', createStyleImage(8), false);

        expect(patternAtlas.getPattern('pattern').displaySize).toEqual([8, 8]);
        expect(patternAtlas.getPixelSize()).toEqual(sizeInAtlas(8));
    });

    test('re-packs the slot when the image is removed and another one is added under the same id, even though neither carries a version', () => {
        imageManager.addImage('pattern', createStyleImage(4));
        const positionOfRemovedImage = patternAtlas.getPattern('pattern');

        imageManager.removeImage('pattern');
        imageManager.addImage('pattern', createStyleImage(8, 255));

        const position = patternAtlas.getPattern('pattern');
        expect(position).not.toBe(positionOfRemovedImage);
        expect(position.displaySize).toEqual([8, 8]);
    });

    test('keeps the slot of an image that was updated in place, as an animated pattern is, and follows its version', () => {
        const image = createStyleImage(4);
        imageManager.addImage('pattern', image);
        const position = patternAtlas.getPattern('pattern');

        imageManager.updateImage('pattern', image, false);

        expect(patternAtlas.getPattern('pattern')).toBe(position);
        expect(position.version).toBe(image.version);
    });

    test('returns null for an image that was removed, and reclaims its slot on the next re-packing', () => {
        imageManager.addImage('removedPattern', createStyleImage(4));
        imageManager.addImage('keptPattern', createStyleImage(4));
        patternAtlas.getPattern('removedPattern');
        patternAtlas.getPattern('keptPattern');

        imageManager.removeImage('removedPattern');

        expect(patternAtlas.getPattern('removedPattern')).toBeNull();

        imageManager.updateImage('keptPattern', createStyleImage(4), false);
        expect(patternAtlas.getPattern('keptPattern').displaySize).toEqual([4, 4]);
        expect(patternAtlas.getPixelSize()).toEqual(sizeInAtlas(4));
    });

    test('uploads the atlas to its texture only once it changed', () => {
        const update = vi.spyOn(Texture.prototype, 'update');
        const bind = vi.spyOn(Texture.prototype, 'bind');
        imageManager.addImage('pattern', createStyleImage(4));
        patternAtlas.getPattern('pattern');

        patternAtlas.bind(context);
        const uploadsToCreateTheTexture = update.mock.calls.length;
        patternAtlas.bind(context);
        expect(update).toHaveBeenCalledTimes(uploadsToCreateTheTexture);

        imageManager.addImage('anotherPattern', createStyleImage(4));
        patternAtlas.getPattern('anotherPattern');
        patternAtlas.bind(context);
        patternAtlas.bind(context);

        expect(update).toHaveBeenCalledTimes(uploadsToCreateTheTexture + 1);
        expect(bind).toHaveBeenCalledTimes(4);
    });

    test('destroy releases the texture and empties the atlas', () => {
        const destroy = vi.spyOn(Texture.prototype, 'destroy');
        imageManager.addImage('pattern', createStyleImage(4));
        patternAtlas.getPattern('pattern');
        patternAtlas.bind(context);

        patternAtlas.destroy();

        expect(destroy).toHaveBeenCalledTimes(1);
        expect(patternAtlas.getPixelSize()).toEqual({width: 1, height: 1});
    });

    test('destroy does nothing to an atlas that was never bound', () => {
        const destroy = vi.spyOn(Texture.prototype, 'destroy');

        expect(() => patternAtlas.destroy()).not.toThrow();
        expect(destroy).not.toHaveBeenCalled();
    });
});

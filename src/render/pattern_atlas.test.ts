import {describe, expect, test, beforeEach} from 'vitest';
import {ImageManager} from './image_manager.ts';
import {PatternAtlas} from './pattern_atlas.ts';
import {RGBAImage} from '../util/image.ts';

import type {StyleImage} from '../style/style_image.ts';

const PADDING_ON_EACH_SIDE = 2;

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

    beforeEach(() => {
        imageManager = new ImageManager();
        patternAtlas = new PatternAtlas(imageManager);
    });

    test('packs an image into a slot padded by one pixel on each side', () => {
        imageManager.addImage('pattern', createStyleImage(4));

        const position = patternAtlas.getPattern('pattern');

        expect(position.displaySize).toEqual([4, 4]);
        expect(patternAtlas.getPixelSize()).toEqual({width: 4 + PADDING_ON_EACH_SIDE, height: 4 + PADDING_ON_EACH_SIDE});
    });

    test('hands back the same position for an image that did not change', () => {
        imageManager.addImage('pattern', createStyleImage(4));

        const position = patternAtlas.getPattern('pattern');

        expect(patternAtlas.getPattern('pattern')).toBe(position);
    });

    test('re-packs the slot when a sprite reload replaces the image with a bigger one', () => {
        imageManager.addImage('pattern', createStyleImage(4));
        patternAtlas.getPattern('pattern');

        // a sprite reload updates without validating the new size against the old one
        imageManager.updateImage('pattern', createStyleImage(8), false);

        expect(patternAtlas.getPattern('pattern').displaySize).toEqual([8, 8]);
        expect(patternAtlas.getPixelSize()).toEqual({width: 8 + PADDING_ON_EACH_SIDE, height: 8 + PADDING_ON_EACH_SIDE});
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

    test('returns null for an image that was removed', () => {
        imageManager.addImage('pattern', createStyleImage(4));
        patternAtlas.getPattern('pattern');

        imageManager.removeImage('pattern');

        expect(patternAtlas.getPattern('pattern')).toBeNull();
    });

    test('reclaims the slot of a removed image on the next re-packing', () => {
        imageManager.addImage('removedPattern', createStyleImage(4));
        imageManager.addImage('keptPattern', createStyleImage(4));
        patternAtlas.getPattern('removedPattern');
        patternAtlas.getPattern('keptPattern');

        imageManager.removeImage('removedPattern');
        imageManager.updateImage('keptPattern', createStyleImage(4), false);

        expect(patternAtlas.getPattern('keptPattern').displaySize).toEqual([4, 4]);
        expect(patternAtlas.getPixelSize()).toEqual({width: 4 + PADDING_ON_EACH_SIDE, height: 4 + PADDING_ON_EACH_SIDE});
    });
});

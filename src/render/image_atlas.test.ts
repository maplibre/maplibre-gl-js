import {describe, expect, test, vi, beforeEach} from 'vitest';
import {ImageAtlas} from './image_atlas.ts';
import {ImageManager} from './image_manager.ts';
import {RGBAImage} from '../util/image.ts';

import type {Texture} from '../webgl/texture.ts';
import type {StyleImage} from '../style/style_image.ts';
import type {GetImagesResponse} from '../util/actor_messages.ts';

const SPRITE_IMAGE_COUNT = 100;
const IMAGE_ID_USED_BY_THE_ATLAS = 'icon-0';

function createStyleImage(): StyleImage {
    return {
        data: new RGBAImage({width: 1, height: 1}, new Uint8Array([0, 0, 0, 0])),
        pixelRatio: 1,
        sdf: false
    };
}

function createTextureStub() {
    return {update: vi.fn()} as any as Texture;
}

/**
 * Builds the response the worker would get from `ImageManager.getImages`, i.e. a snapshot of the
 * images taken at the time the tile was built.
 */
function createImagesSnapshot(imageManager: ImageManager, ids: string[]): GetImagesResponse {
    const snapshot: GetImagesResponse = {};
    for (const id of ids) {
        const image = imageManager.getImage(id);
        snapshot[id] = {
            data: image.data.clone(),
            pixelRatio: image.pixelRatio,
            sdf: image.sdf,
            version: image.version,
            stretchX: image.stretchX,
            stretchY: image.stretchY,
            content: image.content,
            textFitWidth: image.textFitWidth,
            textFitHeight: image.textFitHeight,
            hasRenderCallback: false
        };
    }
    return snapshot;
}

describe('ImageAtlas.patchUpdatedImages', () => {
    let imageManager: ImageManager;
    let atlas: ImageAtlas;
    let texture: Texture;

    beforeEach(() => {
        imageManager = new ImageManager();
        // a sprite with many images, of which this tile's atlas only uses one
        for (let i = 0; i < SPRITE_IMAGE_COUNT; i++) {
            imageManager.addImage(`icon-${i}`, createStyleImage());
        }

        atlas = new ImageAtlas(createImagesSnapshot(imageManager, [IMAGE_ID_USED_BY_THE_ATLAS]), {});
        texture = createTextureStub();
    });

    test('does not upload anything as long as no image was updated', () => {
        atlas.patchUpdatedImages(imageManager, texture);
        atlas.patchUpdatedImages(imageManager, texture);

        expect(texture.update).not.toHaveBeenCalled();
    });

    test('uploads an updated image once instead of on every following frame', () => {
        atlas.patchUpdatedImages(imageManager, texture);

        imageManager.updateImage(IMAGE_ID_USED_BY_THE_ATLAS, createStyleImage());

        atlas.patchUpdatedImages(imageManager, texture);
        atlas.patchUpdatedImages(imageManager, texture);
        atlas.patchUpdatedImages(imageManager, texture);

        expect(texture.update).toHaveBeenCalledTimes(1);
    });

    test('does no per-frame work once it caught up with images it does not contain, no matter how many were updated - see https://github.com/maplibre/maplibre-gl-js/issues/8052', () => {
        atlas.patchUpdatedImages(imageManager, texture);

        for (let i = 0; i < SPRITE_IMAGE_COUNT; i++) {
            imageManager.updateImage(`icon-${i}`, createStyleImage());
        }
        atlas.patchUpdatedImages(imageManager, texture);

        const getImageSpy = vi.spyOn(imageManager, 'getImage');
        atlas.patchUpdatedImages(imageManager, texture);
        atlas.patchUpdatedImages(imageManager, texture);

        expect(getImageSpy).not.toHaveBeenCalled();
    });
});

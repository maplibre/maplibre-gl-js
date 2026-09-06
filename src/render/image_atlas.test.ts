import {describe, test, expect, vi, beforeEach} from 'vitest';
import {ImageAtlas, ImagePosition, IMAGE_PADDING} from './image_atlas.ts';
import {ImageManager} from './image_manager.ts';
import {Context} from '../webgl/context.ts';
import {Texture} from '../webgl/texture.ts';
import {createNullGL} from '../util/test/null_gl.ts';
import {RGBAImage} from '../util/image.ts';

import type {StyleImage} from '../style/style_image.ts';
import type {GetImagesResponse} from '../util/actor_messages.ts';

const SPRITE_IMAGE_COUNT = 100;
const IMAGE_ID_USED_BY_THE_ATLAS = 'icon-0';

const webGLImage = (renderWithWebGL: () => void): StyleImage => ({
    data: new RGBAImage({width: 2, height: 2}),
    version: 1,
    pixelRatio: 1,
    sdf: false,
    isWebGLImage: true,
    userImage: {width: 2, height: 2, data: {renderWithWebGL}}
});

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

test('a WebGL image is packed into the atlas without copying its blank pixels', () => {
    const copy = vi.spyOn(RGBAImage, 'copy');
    const icon = (isWebGLImage?: boolean) => ({data: new RGBAImage({width: 2, height: 2}), version: 0, pixelRatio: 1, sdf: false, isWebGLImage});

    const atlas = new ImageAtlas({webgl: icon(true), pixels: icon()}, {});

    expect(atlas.iconPositions.webgl.paddedRect.w).toBe(2 + 2 * IMAGE_PADDING);
    expect(copy).toHaveBeenCalledTimes(1);
});

test('patchUpdatedImage lets a WebGL image render its own slot instead of uploading pixels', () => {
    const renderWithWebGL = vi.fn();
    const context = new Context(createNullGL());
    const texture = new Texture(context, new RGBAImage({width: 16, height: 16}), context.gl.RGBA);
    const position = new ImagePosition({x: 4, y: 8, w: 4, h: 4}, {version: 0} as StyleImage);
    vi.spyOn(texture, 'update');

    new ImageAtlas({}, {}).patchUpdatedImage(position, webGLImage(renderWithWebGL), texture);

    expect(renderWithWebGL).toHaveBeenCalledWith({gl: context.gl, texture: texture.texture, x: 5, y: 9, width: 2, height: 2});
    expect(texture.update).not.toHaveBeenCalled();
    expect(position.version).toBe(1);
});

test('a WebGL image starts out owing every atlas a render, whatever version it is at', () => {
    const webgl = new ImagePosition({x: 0, y: 0, w: 4, h: 4}, {version: 7, isWebGLImage: true} as StyleImage);
    expect([webgl.needsFirstWebGLRender, webgl.version]).toEqual([true, 7]);
    expect(new ImagePosition({x: 0, y: 0, w: 4, h: 4}, {version: 7} as StyleImage).needsFirstWebGLRender).toBe(false);
});

test('patchUpdatedImages resets WebGL state between images, so the second never trusts a cache the first invalidated', () => {
    const context = new Context(createNullGL());
    const texture = new Texture(context, new RGBAImage({width: 16, height: 16}), context.gl.RGBA);
    vi.spyOn(context, 'setDirty');
    vi.spyOn(context, 'setCustomLayerDefaults');
    let rendered = 0;
    const renderWithWebGL = vi.fn(() => {
        expect(context.setDirty).toHaveBeenCalledTimes(rendered++);
        expect(context.setCustomLayerDefaults).toHaveBeenCalledTimes(rendered);
    });
    const atlas = new ImageAtlas({}, {});
    const imageManager = {
        updateVersion: 1,
        dispatchRenderCallbacks: vi.fn(),
        getImage: () => webGLImage(renderWithWebGL)
    } as any;
    atlas.iconPositions.a = new ImagePosition({x: 0, y: 0, w: 4, h: 4}, {version: 0} as StyleImage);
    atlas.iconPositions.b = new ImagePosition({x: 4, y: 0, w: 4, h: 4}, {version: 0} as StyleImage);

    atlas.patchUpdatedImages(imageManager, texture);

    expect(renderWithWebGL).toHaveBeenCalledTimes(2);
    expect(context.setDirty).toHaveBeenCalledTimes(2);
});

test('a WebGL image the manager only learns about later still gets its first render', () => {
    const context = new Context(createNullGL());
    const texture = new Texture(context, new RGBAImage({width: 16, height: 16}), context.gl.RGBA);
    const renderWithWebGL = vi.fn();
    const imageManager = new ImageManager();
    const atlas = new ImageAtlas({}, {});
    atlas.iconPositions.webgl = new ImagePosition({x: 0, y: 0, w: 4, h: 4}, {version: 0, isWebGLImage: true} as StyleImage);

    atlas.patchUpdatedImages(imageManager, texture);
    expect(renderWithWebGL).not.toHaveBeenCalled();

    imageManager.addImage('webgl', webGLImage(renderWithWebGL));
    atlas.patchUpdatedImages(imageManager, texture);

    expect(renderWithWebGL).toHaveBeenCalledTimes(1);
});

describe('ImageAtlas.patchUpdatedImages', () => {
    let imageManager: ImageManager;
    let atlas: ImageAtlas;
    let texture: Texture;

    beforeEach(() => {
        imageManager = new ImageManager();
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

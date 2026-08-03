import {test, expect, vi} from 'vitest';
import {ImageAtlas, ImagePosition} from './image_atlas.ts';
import {Context} from '../webgl/context.ts';
import {Texture} from '../webgl/texture.ts';
import {createNullGL} from '../util/test/null_gl.ts';
import {RGBAImage} from '../util/image.ts';

import type {StyleImage} from '../style/style_image.ts';

function setup(image: Partial<StyleImage>) {
    const context = new Context(createNullGL());
    const texture = new Texture(context, new RGBAImage({width: 16, height: 16}), context.gl.RGBA);
    const position = new ImagePosition({x: 4, y: 8, w: 4, h: 4}, {version: 0} as StyleImage);
    const styleImage = {data: new RGBAImage({width: 2, height: 2}), version: 1, ...image} as StyleImage;
    return {context, texture, position, styleImage};
}

test('patchUpdatedImage uploads the image data', () => {
    const {context, texture, position, styleImage} = setup({});
    vi.spyOn(texture, 'update');

    new ImageAtlas({}, {}).patchUpdatedImage(position, styleImage, texture);

    // The position is padded by one pixel, so the image starts at (5, 9).
    expect(texture.update).toHaveBeenCalledWith(styleImage.data, undefined, {x: 5, y: 9});
    expect(position.version).toBe(1);
    expect(context.gl.copyTexSubImage2D).not.toHaveBeenCalled();
});

test('patchUpdatedImage lets a userImage paint its own slot instead', () => {
    const renderToTexture = vi.fn();
    const {context, texture, position, styleImage} = setup({userImage: {width: 2, height: 2, data: new Uint8Array(16), renderToTexture}});
    vi.spyOn(texture, 'update');

    new ImageAtlas({}, {}).patchUpdatedImage(position, styleImage, texture);

    expect(renderToTexture).toHaveBeenCalledWith({gl: context.gl, texture: texture.texture, x: 5, y: 9, width: 2, height: 2});
    expect(texture.update).not.toHaveBeenCalled();
});

test('patchUpdatedImages resets WebGL state after every image that painted itself', () => {
    const {context, texture} = setup({});
    vi.spyOn(context, 'setDirty');
    // The reset has to land between the two images: the second one trusts the state cache the
    // first one is free to invalidate.
    let painted = 0;
    const renderToTexture = vi.fn(() => expect(context.setDirty).toHaveBeenCalledTimes(painted++));
    const atlas = new ImageAtlas({}, {});
    const imageManager = {
        updatedImages: {a: true, b: true},
        dispatchRenderCallbacks: vi.fn(),
        getImage: () => ({data: new RGBAImage({width: 2, height: 2}), version: 1,
            userImage: {width: 2, height: 2, data: new Uint8Array(16), renderToTexture}})
    } as any;
    atlas.iconPositions.a = new ImagePosition({x: 0, y: 0, w: 4, h: 4}, {version: 0} as StyleImage);
    atlas.iconPositions.b = new ImagePosition({x: 4, y: 0, w: 4, h: 4}, {version: 0} as StyleImage);

    atlas.patchUpdatedImages(imageManager, texture);

    expect(renderToTexture).toHaveBeenCalledTimes(2);
    expect(context.setDirty).toHaveBeenCalledTimes(2);

    // Nothing left to patch, so nothing to reset.
    atlas.patchUpdatedImages(imageManager, texture);
    expect(context.setDirty).toHaveBeenCalledTimes(2);
});

test('patchUpdatedImage skips an image the atlas already holds at this version', () => {
    const renderToTexture = vi.fn();
    const {texture, position, styleImage} = setup({version: 0, userImage: {width: 2, height: 2, data: new Uint8Array(16), renderToTexture}});
    vi.spyOn(texture, 'update');

    new ImageAtlas({}, {}).patchUpdatedImage(position, styleImage, texture);

    expect(renderToTexture).not.toHaveBeenCalled();
    expect(texture.update).not.toHaveBeenCalled();
});

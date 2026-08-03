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

    expect(texture.update).toHaveBeenCalledWith(styleImage.data, undefined, {x: 5, y: 9});
    expect(position.version).toBe(1);
    expect(context.gl.copyTexSubImage2D).not.toHaveBeenCalled();
});

test('patchUpdatedImage lets a custom image paint its own slot instead', () => {
    const render = vi.fn();
    const {context, texture, position, styleImage} = setup({isCustomImage: true, userImage: {type: 'custom', width: 2, height: 2, render}});
    vi.spyOn(texture, 'update');

    new ImageAtlas({}, {}).patchUpdatedImage(position, styleImage, texture);

    expect(render).toHaveBeenCalledWith({gl: context.gl, texture: texture.texture, x: 5, y: 9, width: 2, height: 2});
    expect(texture.update).not.toHaveBeenCalled();
});

test('a custom image starts out owing every atlas a paint, whatever version it is at', () => {
    const image = {version: 7, isCustomImage: true} as StyleImage;
    expect(new ImagePosition({x: 0, y: 0, w: 4, h: 4}, image).version).toBe(-1);
    expect(new ImagePosition({x: 0, y: 0, w: 4, h: 4}, {version: 7} as StyleImage).version).toBe(7);
});

test('patchUpdatedImages resets WebGL state between images, so the second never trusts a cache the first invalidated', () => {
    const {context, texture} = setup({});
    vi.spyOn(context, 'setDirty');
    let painted = 0;
    const render = vi.fn(() => expect(context.setDirty).toHaveBeenCalledTimes(painted++));
    const atlas = new ImageAtlas({}, {});
    const imageManager = {
        updatedImages: {a: true, b: true},
        dispatchRenderCallbacks: vi.fn(),
        getImage: () => ({data: new RGBAImage({width: 2, height: 2}), version: 1, isCustomImage: true,
            userImage: {type: 'custom', width: 2, height: 2, render}})
    } as any;
    atlas.iconPositions.a = new ImagePosition({x: 0, y: 0, w: 4, h: 4}, {version: 0} as StyleImage);
    atlas.iconPositions.b = new ImagePosition({x: 4, y: 0, w: 4, h: 4}, {version: 0} as StyleImage);

    atlas.patchUpdatedImages(imageManager, texture);

    expect(render).toHaveBeenCalledTimes(2);
    expect(context.setDirty).toHaveBeenCalledTimes(2);

    atlas.patchUpdatedImages(imageManager, texture);
    expect(context.setDirty).toHaveBeenCalledTimes(2);
});

test('patchUpdatedImage skips an image the atlas already holds at this version', () => {
    const render = vi.fn();
    const {texture, position, styleImage} = setup({version: 0, isCustomImage: true, userImage: {type: 'custom', width: 2, height: 2, render}});
    vi.spyOn(texture, 'update');

    new ImageAtlas({}, {}).patchUpdatedImage(position, styleImage, texture);

    expect(render).not.toHaveBeenCalled();
    expect(texture.update).not.toHaveBeenCalled();
});

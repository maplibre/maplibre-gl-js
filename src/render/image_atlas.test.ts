import {test, expect, vi} from 'vitest';
import {ImageAtlas, ImagePosition, IMAGE_PADDING} from './image_atlas.ts';
import {Context} from '../webgl/context.ts';
import {Texture} from '../webgl/texture.ts';
import {createNullGL} from '../util/test/null_gl.ts';
import {RGBAImage} from '../util/image.ts';

import type {StyleImage} from '../style/style_image.ts';

const webGLImage = (renderWithWebGL: () => void): StyleImage => ({
    data: new RGBAImage({width: 2, height: 2}),
    version: 1,
    pixelRatio: 1,
    sdf: false,
    isWebGLImage: true,
    userImage: {width: 2, height: 2, data: {renderWithWebGL}}
});

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
        updatedImages: {a: true, b: true},
        dispatchRenderCallbacks: vi.fn(),
        getImage: () => webGLImage(renderWithWebGL)
    } as any;
    atlas.iconPositions.a = new ImagePosition({x: 0, y: 0, w: 4, h: 4}, {version: 0} as StyleImage);
    atlas.iconPositions.b = new ImagePosition({x: 4, y: 0, w: 4, h: 4}, {version: 0} as StyleImage);

    atlas.patchUpdatedImages(imageManager, texture);

    expect(renderWithWebGL).toHaveBeenCalledTimes(2);
    expect(context.setDirty).toHaveBeenCalledTimes(2);
});

import {test, expect, vi} from 'vitest';
import {ImageManager} from './image_manager.ts';
import {RGBAImage} from '../util/image.ts';

import type {StyleImage} from '../style/style_image.ts';

function webGLImage(render?: () => boolean): StyleImage {
    return {
        data: new RGBAImage({width: 2, height: 2}),
        version: 0,
        pixelRatio: 1,
        sdf: false,
        isWebGLImage: true,
        userImage: {width: 2, height: 2, data: {renderWithWebGL: vi.fn()}, render}
    };
}

function styleImage(size: number = 2): StyleImage {
    return {data: new RGBAImage({width: size, height: size}), pixelRatio: 1, sdf: false};
}

/** An image of a sprite that was never rendered, so its pixels are still in the sprite sheet */
function undecodedSpriteImage(size: number): StyleImage {
    return {
        data: null,
        pixelRatio: 1,
        sdf: false,
        spriteData: {width: size, height: size, x: 0, y: 0, context: null}
    };
}

test('a WebGL image owes every atlas a render as soon as it is added, even without a render callback', () => {
    const manager = new ImageManager();
    const updateVersion = manager.updateVersion;
    manager.addImage('webgl', webGLImage());

    expect(manager.getImage('webgl').version).toBe(1);
    expect(manager.updateVersion).toBe(updateVersion + 1);
});

test('a WebGL image is re-rendered when its render callback reports a change', () => {
    const manager = new ImageManager();
    manager.addImage('webgl', webGLImage(() => true));
    const version = manager.getImage('webgl').version;

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['webgl']);

    expect(manager.getImage('webgl').version).toBe(version + 1);
});

test('a WebGL image is left alone when its render callback reports no change', () => {
    const manager = new ImageManager();
    manager.addImage('webgl', webGLImage(() => false));
    const version = manager.getImage('webgl').version;

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['webgl']);

    expect(manager.getImage('webgl').version).toBe(version);
});

test('a render callback runs once per frame, however many atlases ask for it', () => {
    const manager = new ImageManager();
    const render = vi.fn(() => false);
    manager.addImage('webgl', webGLImage(render));

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['webgl']);
    manager.dispatchRenderCallbacks(['webgl']);
    expect(render).toHaveBeenCalledTimes(1);

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['webgl']);
    expect(render).toHaveBeenCalledTimes(2);
});

test('removing an image that is not there leaves the others alone', () => {
    const manager = new ImageManager();
    manager.addImage('kept', styleImage());

    manager.removeImage('neverAdded');

    expect(manager.listImages()).toEqual(['kept']);
});

test('the images a sprite brought in are removed with it, and reported as removed', () => {
    const manager = new ImageManager();
    manager.setSpriteImages('default', {fromSprite: styleImage(), alsoFromSprite: styleImage()});
    manager.addImage('addedAtRuntime', styleImage());

    expect(manager.removeSpriteImages('default')).toEqual(['fromSprite', 'alsoFromSprite']);
    expect(manager.listImages()).toEqual(['addedAtRuntime']);
    expect(manager.removeSpriteImages('default')).toEqual([]);
});

test('updateImage rejects an image of a different size than the one it replaces', () => {
    const manager = new ImageManager();
    manager.addImage('image', styleImage(2));

    expect(() => manager.updateImage('image', styleImage(4))).toThrow(/size mismatch between old image \(2x2\) and new image \(4x4\)/);
    expect(() => manager.updateImage('image', styleImage(2))).not.toThrow();
});

test('updateImage sizes up a sprite image that was never decoded without decoding it', () => {
    const manager = new ImageManager();
    manager.addImage('image', undecodedSpriteImage(2));

    expect(() => manager.updateImage('image', styleImage(4))).toThrow(/size mismatch between old image \(2x2\) and new image \(4x4\)/);
    expect(() => manager.updateImage('image', styleImage(2))).not.toThrow();
});

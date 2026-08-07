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

test('a WebGL image owes every atlas a render as soon as it is added, even without a render callback', () => {
    const manager = new ImageManager();
    manager.addImage('webgl', webGLImage());

    expect(manager.getImage('webgl').version).toBe(1);
    expect(manager.updatedImages.webgl).toBe(true);
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

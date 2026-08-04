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
        userImage: {width: 2, height: 2, data: {webgl: vi.fn()}, render}
    };
}

test('a WebGL image owes every atlas a paint as soon as it is added, even without a render callback', () => {
    const manager = new ImageManager();
    manager.addImage('webgl', webGLImage());

    expect(manager.getImage('webgl').version).toBe(1);
    expect(manager.updatedImages.webgl).toBe(true);
});

test('a WebGL image is repainted when its render callback reports a change, and left alone otherwise', () => {
    const manager = new ImageManager();
    let changed = false;
    manager.addImage('webgl', webGLImage(() => changed));
    const version = manager.getImage('webgl').version;

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['webgl']);
    expect(manager.getImage('webgl').version).toBe(version);

    changed = true;
    manager.beginFrame();
    manager.dispatchRenderCallbacks(['webgl']);
    expect(manager.getImage('webgl').version).toBe(version + 1);
});

test('invalidating an image the map does not have does nothing', () => {
    const manager = new ImageManager();
    manager.addImage('webgl', webGLImage());
    manager.removeImage('webgl');

    manager.invalidateImage('webgl');
    manager.invalidateImage('never-added');

    expect(manager.getImage('webgl')).toBeUndefined();
    expect(manager.updatedImages['never-added']).toBeUndefined();
});

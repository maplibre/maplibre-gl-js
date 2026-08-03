import {test, expect, vi} from 'vitest';
import {ImageManager} from './image_manager.ts';
import {RGBAImage} from '../util/image.ts';

import type {StyleImage} from '../style/style_image.ts';

function customImage(render = vi.fn()): StyleImage {
    return {
        data: new RGBAImage({width: 2, height: 2}),
        version: 0,
        pixelRatio: 1,
        sdf: false,
        isCustomImage: true,
        userImage: {type: 'custom', width: 2, height: 2, render}
    };
}

test('a custom image is dirty as soon as it is added, and its version moves once per frame', () => {
    const manager = new ImageManager();
    manager.addImage('custom', customImage());
    expect(manager.hasInvalidatedImages()).toBe(true);

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['custom']);
    expect(manager.getImage('custom').version).toBe(1);
    expect(manager.updatedImages.custom).toBe(true);
    // A second atlas dispatching must not move the version out from under the first one's slot.
    manager.dispatchRenderCallbacks(['custom']);
    expect(manager.getImage('custom').version).toBe(1);

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['custom']);
    expect(manager.getImage('custom').version).toBe(1);
    expect(manager.hasInvalidatedImages()).toBe(false);

    manager.invalidateImage('custom');
    manager.beginFrame();
    manager.dispatchRenderCallbacks(['custom']);
    expect(manager.getImage('custom').version).toBe(2);
});

test('a custom image is not drawn during dispatch, but in the atlas patch where there is a texture', () => {
    const render = vi.fn();
    const manager = new ImageManager();
    manager.addImage('custom', customImage(render));

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['custom']);

    expect(render).not.toHaveBeenCalled();
});

test('invalidating an image the map does not have does nothing', () => {
    const manager = new ImageManager();
    manager.invalidateImage('never-added');
    expect(manager.hasInvalidatedImages()).toBe(false);

    manager.addImage('custom', customImage());
    manager.removeImage('custom');
    expect(manager.hasInvalidatedImages()).toBe(false);
});

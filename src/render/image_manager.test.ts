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

test('a custom image owes the atlas a paint when added and on every invalidate, but is drawn by the atlas patch, not here', () => {
    const render = vi.fn();
    const manager = new ImageManager();
    manager.addImage('custom', customImage(render));
    expect(manager.getImage('custom').version).toBe(1);
    expect(manager.updatedImages.custom).toBe(true);

    manager.invalidateImage('custom');
    expect(manager.getImage('custom').version).toBe(2);

    manager.beginFrame();
    manager.dispatchRenderCallbacks(['custom']);
    expect(render).not.toHaveBeenCalled();
    expect(manager.getImage('custom').version).toBe(2);
});

test('invalidating an image the map does not have does nothing', () => {
    const manager = new ImageManager();
    manager.invalidateImage('never-added');

    manager.addImage('custom', customImage());
    manager.removeImage('custom');
    manager.invalidateImage('custom');

    expect(manager.updatedImages['never-added']).toBeUndefined();
});

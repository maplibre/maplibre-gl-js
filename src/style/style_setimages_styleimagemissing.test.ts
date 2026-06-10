import {describe, test, expect, vi} from 'vitest';
import {Style} from './style.ts';
import {extend} from '../util/util.ts';
import {RGBAImage} from '../util/image.ts';
import {type EvaluationParameters} from './evaluation_parameters.ts';
import {type StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import {StubMap} from '../util/test/util.ts';
import {MessageType} from '../util/actor_messages.ts';

function createStyleJSON(properties?): StyleSpecification {
    return extend({
        'version': 8,
        'sources': {},
        'layers': []
    }, properties);
}

function createStyle(map = new StubMap()) {
    return new Style(map as any);
}

describe('setImages broadcast after styleimagemissing', () => {
    test('setImages is broadcast with newly added image after styleimagemissing fires during getImages', async () => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        await style.once('style.load');

        const broadcastSpy = vi.fn().mockReturnValue(Promise.resolve({}));
        style.dispatcher.broadcast = broadcastSpy;

        // Simulate what happens when a user listens for styleimagemissing:
        // When imageManager can't find an image, it fires styleimagemissing,
        // and the user's handler adds the image synchronously.
        style.imageManager.on('styleimagemissing', (e: {id: string}) => {
            style.addImage(e.id, {
                data: new RGBAImage({width: 1, height: 1}, new Uint8Array(4)),
                pixelRatio: 1,
                sdf: false,
            });
        });

        // Trigger the flow: worker requests an image that doesn't exist.
        // This calls imageManager.getImages() which fires styleimagemissing,
        // then _updateTilesForChangedImages() clears _changedImages.
        await style.getImages('0', {
            icons: ['missing-image'],
            source: 'test-source',
            tileID: {key: 'test-tile'} as any,
            type: 'icons',
        });

        // Now simulate the next animation frame
        style.update({} as EvaluationParameters);

        // Verify that setImages was broadcast at least once with the new image
        const setImagesCalls = broadcastSpy.mock.calls.filter(
            (c) => c[0] === MessageType.setImages
        );
        expect(setImagesCalls.length).toBeGreaterThanOrEqual(1);

        const broadcastedImages = setImagesCalls.flatMap((c) => c[1]);
        expect(broadcastedImages).toContain('missing-image');
    });
});

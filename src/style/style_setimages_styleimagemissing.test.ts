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

describe('setImages broadcast is not prevented by getImages', () => {
    test('setImages broadcasts even when getImages is called between addImage and update', async () => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        await style.once('style.load');

        const broadcastSpy = vi.fn().mockReturnValue(Promise.resolve({}));
        style.dispatcher.broadcast = broadcastSpy;

        // User adds an image — broadcast is deferred to next update()
        style.addImage('new-image', {
            data: new RGBAImage({width: 1, height: 1}, new Uint8Array(4)),
            pixelRatio: 1,
            sdf: false,
        });

        // Before update() runs, a worker tile happens to call getImages
        // for an unrelated image. This clears _changedImages internally
        // but should not prevent the setImages broadcast.
        await style.getImages('0', {
            icons: ['some-other-image'],
            source: 'test-source',
            tileID: {key: 'test-tile'} as any,
            type: 'icons',
        });

        // Next animation frame
        style.update({} as EvaluationParameters);

        const setImagesCalls = broadcastSpy.mock.calls.filter(
            (c) => c[0] === MessageType.setImages
        );
        expect(setImagesCalls.length).toBeGreaterThanOrEqual(1);
        expect(setImagesCalls.flatMap((c) => c[1])).toContain('new-image');
    });

    test('setImages broadcasts after styleimagemissing handler adds an image', async () => {
        const style = createStyle();
        style.loadJSON(createStyleJSON());
        await style.once('style.load');

        const broadcastSpy = vi.fn().mockReturnValue(Promise.resolve({}));
        style.dispatcher.broadcast = broadcastSpy;

        // User listens for styleimagemissing and adds the image synchronously
        style.imageManager.on('styleimagemissing', (e: {id: string}) => {
            style.addImage(e.id, {
                data: new RGBAImage({width: 1, height: 1}, new Uint8Array(4)),
                pixelRatio: 1,
                sdf: false,
            });
        });

        // Worker tile requests a missing image — triggers styleimagemissing,
        // handler adds it, then getImages clears _changedImages internally.
        await style.getImages('0', {
            icons: ['missing-image'],
            source: 'test-source',
            tileID: {key: 'test-tile'} as any,
            type: 'icons',
        });

        // Next animation frame
        style.update({} as EvaluationParameters);

        const setImagesCalls = broadcastSpy.mock.calls.filter(
            (c) => c[0] === MessageType.setImages
        );
        expect(setImagesCalls.length).toBeGreaterThanOrEqual(1);
        expect(setImagesCalls.flatMap((c) => c[1])).toContain('missing-image');
    });
});

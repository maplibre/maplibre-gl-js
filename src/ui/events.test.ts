import {describe, expect, test} from 'vitest';
import {ErrorEvent, Event, Evented} from '../util/evented.ts';
import type {MapEventTypeBase} from './events.ts';

class DrawCreateEvent extends Event<'draw.create'> {
    features: object[];

    constructor(features: object[]) {
        super('draw.create');
        this.features = features;
    }
}

/**
 * A local mirror of the {@link CustomMapEventType} extension point.
 *
 * The real interface is deliberately NOT augmented here: an augmentation is global, so a
 * fictional event would land on the published `MapEventType` and in the generated
 * documentation. Merging two declarations of a local interface exercises the same
 * mechanism.
 */
// eslint-disable-next-line local/prefer-type-for-data-shapes
interface LocalCustomEventType {
    'draw.create': DrawCreateEvent;
}

// a second declaration, merged into the first - what a consumer's `declare module` does
// eslint-disable-next-line local/prefer-type-for-data-shapes
interface LocalCustomEventType {
    'draw.delete': Event<'draw.delete'>;
}

type LocalMapEventType = {
    [K in keyof (MapEventTypeBase & LocalCustomEventType)]:
    (MapEventTypeBase & LocalCustomEventType)[K];
};

class LocalEmitter extends Evented<LocalMapEventType> {}

describe('extending the map event map', () => {
    test('a merged event is accepted and its payload inferred', () => {
        const emitter = new LocalEmitter();
        const received: object[][] = [];

        emitter.on('draw.create', (ev) => { received.push(ev.features); });
        emitter.fire(new DrawCreateEvent([{id: 'p1'}]));

        expect(received).toEqual([[{id: 'p1'}]]);
    });

    test('a second merged declaration is also accepted', () => {
        const emitter = new LocalEmitter();
        const seen: string[] = [];

        emitter.on('draw.delete', (ev) => { seen.push(ev.type); });
        emitter.fire(new Event('draw.delete'));

        expect(seen).toEqual(['draw.delete']);
    });

    test('built-in events still infer their own payload', () => {
        const emitter = new LocalEmitter();
        const messages: string[] = [];

        emitter.on('error', (ev) => { messages.push(ev.error.message); });
        emitter.fire(new ErrorEvent(new Error('boom')));

        expect(messages).toEqual(['boom']);
    });
});

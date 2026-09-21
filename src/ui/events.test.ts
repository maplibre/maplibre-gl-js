import {describe, expect, test} from 'vitest';
import {Event, Evented} from '../util/evented.ts';

import type {MapEventType} from './events.ts';

class DrawCreateEvent extends Event<'draw.create'> {
    features: object[];
    constructor(features: object[]) {
        super('draw.create');
        this.features = features;
    }
}

declare module './events.ts' {
    // eslint-disable-next-line local/prefer-type-for-data-shapes
    interface CustomMapEventType {
        'draw.create': DrawCreateEvent;
    }
}

class MapEventEmitter extends Evented<MapEventType> {}

describe('CustomMapEventType', () => {
    test('a consumer-added event is accepted and its payload inferred', () => {
        const emitter = new MapEventEmitter();
        const got: object[][] = [];
        emitter.on('draw.create', (ev) => { got.push(ev.features); });
        emitter.fire(new DrawCreateEvent([{id: 'p1'}]));
        expect(got).toEqual([[{id: 'p1'}]]);
    });
});

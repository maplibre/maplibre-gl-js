import {describe, expect, test} from 'vitest';
import {ErrorEvent, Event, Evented} from '../util/evented.ts';
import type {MapEventType} from './events.ts';

/**
 * An event MapLibre does not ship itself. This stands in for the events fired by a
 * third-party plugin on the map instance - `mapbox-gl-draw`, for example, fires
 * `draw.create` / `draw.update` / `draw.delete`.
 */
class DrawCreateEvent extends Event<'draw.create'> {
    features: object[];

    constructor(features: object[]) {
        super('draw.create');
        this.features = features;
    }
}

/**
 * The consumer-side escape hatch this file exists to pin down. Applications write the
 * same thing against the published package:
 *
 * ```ts
 * declare module 'maplibre-gl' {
 *     interface MapEventType {
 *         'draw.create': DrawCreateEvent;
 *     }
 * }
 * ```
 *
 * It compiles only because `MapEventType` is an `interface`; a `type` alias cannot be
 * merged into. See https://github.com/maplibre/maplibre-gl-js/issues/8419
 */
declare module './events.ts' {
    // eslint-disable-next-line local/prefer-type-for-data-shapes
    interface MapEventType {
        'draw.create': DrawCreateEvent;
    }
}

class MapEventEmitter extends Evented<MapEventType> {}

describe('MapEventType declaration merging', () => {
    test('an event added by a consumer is accepted, and its payload is inferred', () => {
        const emitter = new MapEventEmitter();
        const received: object[][] = [];

        // `ev` is inferred as DrawCreateEvent - reading `.features` off it is what proves
        // the payload survived the merge rather than collapsing to a union or to `any`.
        emitter.on('draw.create', (ev) => {
            received.push(ev.features);
        });
        emitter.fire(new DrawCreateEvent([{id: 'polygon-1'}]));

        expect(received).toEqual([[{id: 'polygon-1'}]]);
    });

    test('built-in events still infer their own payload', () => {
        const emitter = new MapEventEmitter();
        const messages: string[] = [];

        emitter.on('error', (ev) => {
            messages.push(ev.error.message);
        });
        emitter.fire(new ErrorEvent(new Error('boom')));

        expect(messages).toEqual(['boom']);
    });

    test('merging does not loosen the event map', () => {
        const emitter = new MapEventEmitter();

        // cspell:ignore craete
        // @ts-expect-error - a misspelled event name is still rejected
        emitter.on('draw.craete', () => {});

        // @ts-expect-error - an event map whose values are not Events is still rejected
        class NotAnEventMap extends Evented<{foo: string}> {}

        expect(NotAnEventMap).toBeDefined();
    });
});

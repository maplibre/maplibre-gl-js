import {describe, expect, test} from 'vitest';
import {Event, Evented} from '../util/evented.ts';

/**
 * Events MapLibre does not ship itself. These stand in for the events a third-party
 * plugin fires on the map instance - `mapbox-gl-draw`, for example, fires
 * `draw.create` / `draw.update` / `draw.delete`.
 */
class DrawCreateEvent extends Event<'draw.create'> {
    features: object[];

    constructor(features: object[]) {
        super('draw.create');
        this.features = features;
    }
}

class DrawDeleteEvent extends Event<'draw.delete'> {}

/**
 * An event map declared as an `interface` rather than a `type` alias, which is what
 * consumers need in order to extend it. This is deliberately a local stand-in for
 * {@link MapEventType} rather than an augmentation of it: augmenting the real type would
 * add a fictional event to the public API surface and to the generated documentation.
 *
 * On its own, this declaration is the regression guard - before
 * https://github.com/maplibre/maplibre-gl-js/issues/8419 an `interface` could not satisfy
 * the `Evented` type parameter at all:
 *
 * ```
 * error TS2344: Type 'PluginEventType' does not satisfy the constraint 'EventTypeMap'.
 *   Index signature for type 'string' is missing in type 'PluginEventType'.
 * ```
 */
// eslint-disable-next-line local/prefer-type-for-data-shapes
interface PluginEventType {
    'draw.create': DrawCreateEvent;
}

/**
 * A second declaration of the same interface, which TypeScript merges into the first.
 * This is the mechanism consumers use against the published package:
 *
 * ```ts
 * declare module 'maplibre-gl' {
 *     interface MapEventType {
 *         'draw.create': DrawCreateEvent;
 *     }
 * }
 * ```
 */
// eslint-disable-next-line local/prefer-type-for-data-shapes
interface PluginEventType {
    'draw.delete': DrawDeleteEvent;
}

class PluginEmitter extends Evented<PluginEventType> {}

describe('extending an event map by declaration merging', () => {
    test('an interface can be used as an event map, and infers its payloads', () => {
        const emitter = new PluginEmitter();
        const received: object[][] = [];

        // `ev` is inferred as DrawCreateEvent - reading `.features` off it is what proves
        // the payload type survived rather than collapsing to a union or to `any`.
        emitter.on('draw.create', (ev) => {
            received.push(ev.features);
        });
        emitter.fire(new DrawCreateEvent([{id: 'polygon-1'}]));

        expect(received).toEqual([[{id: 'polygon-1'}]]);
    });

    test('an event added by a second, merged declaration is also accepted', () => {
        const emitter = new PluginEmitter();
        const seen: string[] = [];

        emitter.on('draw.delete', (ev) => {
            seen.push(ev.type);
        });
        emitter.fire(new DrawDeleteEvent('draw.delete'));

        expect(seen).toEqual(['draw.delete']);
    });

    test('merging does not loosen the event map', () => {
        const emitter = new PluginEmitter();

        // cspell:ignore craete
        // @ts-expect-error - a misspelled event name is still rejected
        emitter.on('draw.craete', () => {});

        // @ts-expect-error - an event map whose values are not Events is still rejected
        class NotAnEventMap extends Evented<{foo: string}> {}

        expect(NotAnEventMap).toBeDefined();
    });
});

import {describe, beforeEach, test, expect, vi, afterEach} from 'vitest';
import {CanvasSource, type CanvasSourceSpecification} from '../source/canvas_source';
import {Event, Evented} from '../util/evented';
import {extend} from '../util/util';
import {Tile} from '../tile/tile';
import {OverscaledTileID} from '../tile/tile_id';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {waitForEvent} from '../util/test/util';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {Dispatcher} from '../util/dispatcher';
import type {MapSourceDataEvent} from '../ui/events';

function createSource(options?: { canvas?: any; eventedParent?: any} & Partial<CanvasSourceSpecification>) {
    const c = options && options.canvas || window.document.createElement('canvas');
    c.width = 20;
    c.height = 20;

    options = extend({
        canvas: 'id',
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }, options);

    const source = new CanvasSource('id', options as CanvasSourceSpecification, {} as Dispatcher, options.eventedParent);

    source.canvas = c;

    return source;
}

class StubMap extends Evented {
    transform: IReadonlyTransform;
    style: any;
    painter: any;

    constructor() {
        super();
        this.transform = new MercatorTransform();
        this.style = {};
        this.painter = {
            context: {
                gl: {}
            }
        };
    }

    triggerRepaint() {
        this.fire(new Event('rerender'));
    }
}

describe('CanvasSource', () => {
    let map;
    beforeEach(() => {
        map = new StubMap();
    });

    test('constructor', async () => {
        const source = createSource();

        expect(source.minzoom).toBe(0);
        expect(source.maxzoom).toBe(22);
        expect(source.tileSize).toBe(512);
        expect(source.animate).toBe(true);

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.dataType === 'source' && e.sourceDataType === 'metadata');

        source.onAdd(map);
        await promise;

        expect(typeof source.play).toBe('function');
    });

    describe('Validations', () => {
        const errorSpy = vi.fn();
        let eventedParent: Evented;
        beforeEach(() => {
            eventedParent = new Evented();
            eventedParent.on('error', errorSpy);
        });
        afterEach(() => {
            errorSpy.mockClear();
        });
        test('self-validates coordinates array length', () => {
            createSource({coordinates: [], eventedParent} as any);
            expect(errorSpy).toHaveBeenCalled();
        });

        test('self-validates coordinates as string', () => {
            createSource({coordinates: 'asdf', eventedParent} as any);
            expect(errorSpy).toHaveBeenCalled();
        });

        test('self-validates animate as number', () => {
            createSource({animate: 8, eventedParent} as any);
            expect(errorSpy).toHaveBeenCalled();
        });

        test('self-validates canvas as empty opbject', () => {
            createSource({canvas: {}, eventedParent} as any);
            expect(errorSpy).toHaveBeenCalled();
        });

        test('self-validates passes on valid canvas object', () => {
            const canvasEl = document.createElement('canvas');
            createSource({canvas: canvasEl, eventedParent});
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    test('can be initialized with HTML element', async () => {
        const el = document.createElement('canvas');
        const source = createSource({
            canvas: el
        });

        const prmoise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.dataType === 'source' && e.sourceDataType === 'metadata');

        source.onAdd(map);

        await prmoise;
        expect(source.canvas).toBe(el);
    });

    test('rerenders if animated', async () => {
        const source = createSource();

        const promise = waitForEvent(map, 'rerender', () => true);

        source.onAdd(map);

        await expect(promise).resolves.toBeDefined();
    });

    test('can be static', async () => {
        const source = createSource({
            animate: false
        });

        const spy = vi.fn();
        map.on('rerender', spy);

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.dataType === 'source' && e.sourceDataType === 'metadata');

        source.onAdd(map);

        await expect(promise).resolves.toBeDefined();
        expect(spy).not.toHaveBeenCalled();
    });

    test('onRemove stops animation', () => {
        const source = createSource();

        source.onAdd(map);

        expect(source.hasTransition()).toBe(true);

        source.onRemove();

        expect(source.hasTransition()).toBe(false);

        source.onAdd(map);

        expect(source.hasTransition()).toBe(true);

    });

    test('play and pause animation', () => {
        const source = createSource();

        source.onAdd(map);

        expect(source.hasTransition()).toBe(true);

        source.pause();

        expect(source.hasTransition()).toBe(false);

        source.play();

        expect(source.hasTransition()).toBe(true);

    });

    test('fires idle event on prepare call when there is at least one not loaded tile', async () => {
        const source = createSource();
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.dataType === 'source' && e.sourceDataType === 'idle');
        source.onAdd(map);

        source.tiles[String(tile.tileID.wrap)] = tile;
        // assign dummies directly so we don't need to stub the gl things
        source.texture = {
            update: () => {}
        } as any;
        source.prepare();

        await promise;
        expect(tile.state).toBe('loaded');
    });

});

test('CanvasSource.serialize', () => {
    const source = createSource();

    const serialized = source.serialize();
    expect(serialized.type).toBe('canvas');
    expect(serialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);

});

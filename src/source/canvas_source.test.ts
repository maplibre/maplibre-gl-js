import CanvasSource from '../source/canvas_source';
import Transform from '../geo/transform';
import {Event, Evented} from '../util/evented';
import {extend} from '../util/util';

import type Dispatcher from '../util/dispatcher';

function createSource(options?) {
    const c = options && options.canvas || window.document.createElement('canvas');
    c.width = 20;
    c.height = 20;

    options = extend({
        canvas: 'id',
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }, options);

    const source = new CanvasSource('id', options, {} as Dispatcher, options.eventedParent);

    source.canvas = c;

    return source;
}

class StubMap extends Evented {
    transform: Transform;
    style: any;

    constructor() {
        super();
        this.transform = new Transform();
        this.style = {};
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

    test('constructor', done => {
        const source = createSource();

        expect(source.minzoom).toBe(0);
        expect(source.maxzoom).toBe(22);
        expect(source.tileSize).toBe(512);
        expect(source.animate).toBe(true);
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(typeof source.play).toBe('function');
                done();
            }
        });

        source.onAdd(map);
    });

    test('self-validates', () => {
        const stub = jest.spyOn(console, 'error');
        createSource({coordinates: []});
        expect(stub).toHaveBeenCalled();
        stub.mockReset();

        createSource({coordinates: 'asdf'});
        expect(stub).toHaveBeenCalled();
        stub.mockReset();

        createSource({animate: 8});
        expect(stub).toHaveBeenCalled();
        stub.mockReset();

        createSource({canvas: {}});
        expect(stub).toHaveBeenCalled();
        stub.mockReset();

        const canvasEl = window.document.createElement('canvas');
        createSource({canvas: canvasEl});
        expect(stub).not.toHaveBeenCalled();
        stub.mockReset();

    });

    test('can be initialized with HTML element', done => {
        const el = window.document.createElement('canvas');
        const source = createSource({
            canvas: el
        });

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(source.canvas).toBe(el);
                done();
            }
        });

        source.onAdd(map);
    });

    test('rerenders if animated', done => {
        const source = createSource();

        map.on('rerender', () => {
            expect(true).toBeTruthy();
            done();
        });

        source.onAdd(map);
    });

    test('can be static', done => {
        const source = createSource({
            animate: false
        });

        map.on('rerender', () => {
            // this just confirms it didn't happen, so no need to run done() here
            // if called the test will fail
            expect(true).toBeFalsy();
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                expect(true).toBeTruthy();
                done();
            }
        });

        source.onAdd(map);
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

});

describe('CanvasSource#serialize', () => {
    const source = createSource();

    const serialized = source.serialize();
    expect(serialized.type).toBe('canvas');
    expect(serialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);

});

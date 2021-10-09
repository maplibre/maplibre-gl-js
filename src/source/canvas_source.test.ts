import CanvasSource from '../source/canvas_source';
import Transform from '../geo/transform';
import {Event, Evented} from '../util/evented';
import {extend} from '../util/util';
import {stub as sinonStub} from 'sinon';

import type Map from '../ui/map';
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
    test('constructor', () => {
        const source = createSource();

        expect(source.minzoom).toBe(0);
        expect(source.maxzoom).toBe(22);
        expect(source.tileSize).toBe(512);
        expect(source.animate).toBe(true);
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(typeof source.play).toBe('function');
            }
        });

        source.onAdd(new StubMap() as Map);
    });

    test('self-validates', () => {
        const stub = sinonStub(console, 'error');
        createSource({coordinates: []});
        expect(stub.called).toBeTruthy();
        stub.resetHistory();

        createSource({coordinates: 'asdf'});
        expect(stub.called).toBeTruthy();
        stub.resetHistory();

        createSource({animate: 8});
        expect(stub.called).toBeTruthy();
        stub.resetHistory();

        createSource({canvas: {}});
        expect(stub.called).toBeTruthy();
        stub.resetHistory();

        const canvasEl = window.document.createElement('canvas');
        createSource({canvas: canvasEl});
        expect(stub.called).toBeFalsy();
        stub.resetHistory();

    });

    test('can be initialized with HTML element', () => {
        const el = window.document.createElement('canvas');
        const source = createSource({
            canvas: el
        });

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(source.canvas).toBe(el);
            }
        });

        source.onAdd(new StubMap() as Map);
    });

    test('rerenders if animated', () => {
        const source = createSource();
        const map = new StubMap();

        map.on('rerender', () => {
            expect(true).toBeTruthy();
        });

        source.onAdd(map as Map);
    });

    test('can be static', () => {
        const source = createSource({
            animate: false
        });
        const map = new StubMap();

        map.on('rerender', () => {
            expect(true).toBeFalsy();
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                expect(true).toBeTruthy();
            }
        });

        source.onAdd(map as Map);
    });

    test('onRemove stops animation', () => {
        const source = createSource();
        const map = new StubMap();

        source.onAdd(map as Map);

        expect(source.hasTransition()).toBe(true);

        source.onRemove();

        expect(source.hasTransition()).toBe(false);

        source.onAdd(map as Map);

        expect(source.hasTransition()).toBe(true);

    });

    test('play and pause animation', () => {
        const source = createSource();
        const map = new StubMap();

        source.onAdd(map as Map);

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

import '../../stub_loader';
import {test} from '../../util/test';
import CanvasSource from '../../../rollup/build/tsc/source/canvas_source';
import Transform from '../../../rollup/build/tsc/geo/transform';
import {Event, Evented} from '../../../rollup/build/tsc/util/evented';
import {extend} from '../../../rollup/build/tsc/util/util';

let originalGetContext = HTMLCanvasElement.prototype.getContext;

function createSource(options) {
    
    HTMLCanvasElement.prototype.getContext = () =>  { return '2d'; };
    

    const c = options && options.canvas || window.document.createElement('canvas');
    c.width = 20;
    c.height = 20;

    options = extend({
        canvas: 'id',
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }, options);

    const source = new CanvasSource('id', options, {send() {}}, options.eventedParent);

    source.canvas = c;

    return source;
}

class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new Transform();
        this.style = {};
    }

    triggerRepaint() {
        this.fire(new Event('rerender'));
    }
}

test('CanvasSource', (t) => {
    t.afterEach((callback) => {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        callback();
    });

    t.test('constructor', (t) => {
        const source = createSource();

        expect(source.minzoom).toBe(0);
        expect(source.maxzoom).toBe(22);
        expect(source.tileSize).toBe(512);
        expect(source.animate).toBe(true);
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(typeof source.play).toBe('function');
                t.end();
            }
        });

        source.onAdd(new StubMap());
    });

    t.test('self-validates', (t) => {
        const stub = t.stub(console, 'error');
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

        t.end();
    });

    t.test('can be initialized with HTML element', (t) => {
        const el = window.document.createElement('canvas');
        const source = createSource({
            canvas: el
        });

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(source.canvas).toBe(el);
                t.end();
            }
        });

        source.onAdd(new StubMap());
    });

    t.test('rerenders if animated', (t) => {
        const source = createSource();
        const map = new StubMap();

        map.on('rerender', () => {
            expect(true).toBeTruthy();
            t.end();
        });

        source.onAdd(map);
    });

    t.test('can be static', (t) => {
        const source = createSource({
            animate: false
        });
        const map = new StubMap();

        map.on('rerender', () => {
            expect(true).toBeFalsy();
            t.end();
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                expect(true).toBeTruthy();
                t.end();
            }
        });

        source.onAdd(map);
    });

    t.test('onRemove stops animation', (t) => {
        const source = createSource();
        const map = new StubMap();

        source.onAdd(map);

        expect(source.hasTransition()).toBe(true);

        source.onRemove();

        expect(source.hasTransition()).toBe(false);

        source.onAdd(map);

        expect(source.hasTransition()).toBe(true);

        t.end();
    });

    t.test('play and pause animation', (t) => {
        const source = createSource();
        const map = new StubMap();

        source.onAdd(map);

        expect(source.hasTransition()).toBe(true);

        source.pause();

        expect(source.hasTransition()).toBe(false);

        source.play();

        expect(source.hasTransition()).toBe(true);

        t.end();
    });

    t.end();
});

test('CanvasSource#serialize', (t) => {
    const source = createSource();

    const serialized = source.serialize();
    expect(serialized.type).toBe('canvas');
    expect(serialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);

    t.end();
});

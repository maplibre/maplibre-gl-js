import {createMap, beforeMapTest, createStyle} from '../../util/test/util';
import {fakeServer, FakeServer} from 'nise';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

test('render stabilizes', () => new Promise<void>((done) => {
    const style = createStyle();
    style.sources.mapbox = {
        type: 'vector',
        minzoom: 1,
        maxzoom: 10,
        tiles: ['http://example.com/{z}/{x}/{y}.png']
    };
    style.layers.push({
        id: 'layerId',
        type: 'circle',
        source: 'mapbox',
        'source-layer': 'sourceLayer'
    });

    let timer;
    const map = createMap({style});
    map.on('render', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            map.off('render', undefined);
            map.on('render', () => {
                throw new Error('test failed');
            });
            expect((map as any)._frameId).toBeFalsy();
            done();
        }, 100);
    });
}));

test('no render after idle event', () => new Promise<void>((done) => {
    const style = createStyle();
    const map = createMap({style});
    map.on('idle', () => {
        map.on('render', () => {
            throw new Error('test failed');
        });
        setTimeout(() => {
            done();
        }, 100);
    });
}));

test('no render before style loaded', () => new Promise<void>((done) => {
    server.respondWith('/styleUrl', JSON.stringify(createStyle()));
    const map = createMap({style: '/styleUrl'});

    jest.spyOn(map, 'triggerRepaint').mockImplementationOnce(() => {
        if (!map.style._loaded) {
            throw new Error('test failed');
        }
    });
    map.on('render', () => {
        if (map.style._loaded) {
            done();
        } else {
            throw new Error('test failed');
        }
    });

    // Force a update should not call triggerRepaint till style is loaded.
    // Once style is loaded, it will trigger the update.
    map._update();
    server.respond();
}));

test('#redraw', async () => {
    const map = createMap();

    await map.once('idle');
    const renderPromise = map.once('render');

    map.redraw();
    await renderPromise;
});

import {beforeEach, afterEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest, createStyle, sleep} from '../../util/test/util.ts';
import {fakeServer, type FakeServer} from 'nise';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

test('render stabilizes', async () => {
    const style = createStyle();
    style.sources.maplibre = {
        type: 'vector',
        minzoom: 1,
        maxzoom: 10,
        tiles: ['http://example.com/{z}/{x}/{y}.png']
    };
    style.layers.push({
        id: 'layerId',
        type: 'circle',
        source: 'maplibre',
        'source-layer': 'sourceLayer'
    });

    let timer;
    const map = createMap({style});
    const spy = vi.fn();
    map.on('render', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            map.off('render', undefined);
            map.on('render', () => {
                throw new Error('test failed');
            });
            expect((map as any)._frameId).toBeFalsy();
            spy();
        }, 100);
    });
    await sleep(700);
    expect(spy).toHaveBeenCalled();
});

test('no render after idle event', async () => {
    const style = createStyle();
    const map = createMap({style});
    await map.once('idle');
    const spy = vi.fn();
    map.on('render', spy);
    await sleep(100);
    expect(spy).not.toHaveBeenCalled();
});

test('no render before style loaded', async () => {
    server.respondWith('/styleUrl', JSON.stringify(createStyle()));
    const map = createMap({style: '/styleUrl'});

    vi.spyOn(map, 'triggerRepaint').mockImplementationOnce(() => {
        if (!map.style._loaded) {
            throw new Error('test failed');
        }
    });

    let loaded = true;
    map.on('render', () => {
        loaded = map.style._loaded;
    });

    // Force a update should not call triggerRepaint till style is loaded.
    // Once style is loaded, it will trigger the update.
    map._update();
    expect(loaded).toBeTruthy();
    server.respond();
    expect(loaded).toBeTruthy();
});

test('redraw', async () => {
    const map = createMap();

    await map.once('idle');
    const renderPromise = map.once('render');

    map.redraw();
    await renderPromise;
});

test('render event carries timing metadata', async () => {
    const map = createMap();
    await map.once('idle');

    const renderPromise = map.once('render');
    map.redraw();
    const event = await renderPromise;

    expect(event.timing).toBeDefined();
    expect(typeof event.timing.renderStart).toBe('number');
    expect(typeof event.timing.commandsSubmitted).toBe('number');
    expect(typeof event.timing.renderDuration).toBe('number');
    // Sanity: end is at or after start, duration matches the bracket.
    expect(event.timing.commandsSubmitted).toBeGreaterThanOrEqual(event.timing.renderStart);
    expect(event.timing.renderDuration).toBeCloseTo(event.timing.commandsSubmitted - event.timing.renderStart, 5);
    // Duration should be non-negative and reasonable for a synthetic test (well under a second).
    expect(event.timing.renderDuration).toBeGreaterThanOrEqual(0);
    expect(event.timing.renderDuration).toBeLessThan(1000);
});

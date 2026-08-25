import {describe, beforeEach, afterEach, test, expect, vi, type MockInstance} from 'vitest';
import {createMap, beforeMapTest, createStyle, sleep} from '../../util/test/util.ts';
import {fakeServer, type FakeServer} from 'nise';
import {PauseablePlacement} from '../../style/pauseable_placement.ts';
import {now, setNow, restoreNow} from '../../util/time_control.ts';
import type {Map} from '../map.ts';

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
    await expect(renderPromise).resolves.toBeDefined();
});

describe('symbol placement re-runs', () => {
    let map: Map;
    let time: number;
    let placementRun: MockInstance<PauseablePlacement['continuePlacement']>;

    /** Leaves placement committed and past its recency window, so the next run is free to be skipped. */
    function settle() {
        map.redraw();
        setNow(time += 1000);
        placementRun.mockClear();
    }

    beforeEach(async () => {
        placementRun = vi.spyOn(PauseablePlacement.prototype, 'continuePlacement');
        map = createMap({style: {
            version: 8,
            sources: {geojson: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
            layers: [{id: 'symbol', type: 'symbol', source: 'geojson'}]
        }});
        await map.once('idle');
        time = now();
        setNow(time);
    });

    afterEach(() => {
        placementRun.mockRestore();
        restoreNow();
    });

    test('placement is not re-run while its inputs are unchanged', () => {
        settle();

        map.redraw();
        expect(placementRun).not.toHaveBeenCalled();
    });

    test('a zoom change re-places, and then settles again instead of looping', () => {
        settle();

        map.setZoom(3);
        map.redraw();
        expect(placementRun).toHaveBeenCalled();

        settle();
        map.redraw();
        expect(placementRun).not.toHaveBeenCalled();
    });

    test('a paint property change re-places, and then settles again instead of looping', () => {
        settle();

        map.setPaintProperty('symbol', 'icon-translate', [5, 5]);
        map.redraw();
        expect(placementRun).toHaveBeenCalled();

        settle();
        map.redraw();
        expect(placementRun).not.toHaveBeenCalled();
    });

    test('a renderWorldCopies change re-places, and then settles again instead of looping', () => {
        settle();

        map.setRenderWorldCopies(false);
        map.redraw();
        expect(placementRun).toHaveBeenCalled();

        settle();
        map.redraw();
        expect(placementRun).not.toHaveBeenCalled();
    });

    test('a showCollisionBoxes change re-places, and then settles again instead of looping', () => {
        settle();

        map.showCollisionBoxes = true;
        map.redraw();
        expect(placementRun).toHaveBeenCalled();

        settle();
        map.redraw();
        expect(placementRun).not.toHaveBeenCalled();
    });

    test('a stale placement gets its final re-run even after its inputs settled', () => {
        settle();

        map.style.placement.setStale();
        map.redraw();
        expect(placementRun).toHaveBeenCalled();

        placementRun.mockClear();
        setNow(time += 1000);
        map.redraw();
        expect(placementRun).not.toHaveBeenCalled();
    });
});

describe('symbol fade after the placement guard', () => {
    afterEach(() => {
        restoreNow();
    });

    test('a placement change keeps the map rendering through fadeDuration, then it goes idle', async () => {
        const map = createMap({style: {
            version: 8,
            sources: {geojson: {type: 'geojson', data: {type: 'FeatureCollection', features: [
                {type: 'Feature', geometry: {type: 'Point', coordinates: [-20, 0]}, properties: {}},
                {type: 'Feature', geometry: {type: 'Point', coordinates: [20, 0]}, properties: {}}
            ]}}},
            layers: []
        }});
        await map.once('load');
        map.addImage('dot', {width: 80, height: 80, data: new Uint8Array(80 * 80 * 4)});
        map.addLayer({id: 'symbol', type: 'symbol', source: 'geojson', layout: {'icon-image': 'dot'}});
        await map.once('idle');
        const idle = vi.fn();
        map.on('idle', idle);
        let time = now();
        setNow(time);

        // Zooming in separates the icons, so the one that lost the collision fades in.
        map.setZoom(0.9);
        map.redraw();

        setNow(time += 100);
        map.redraw();
        expect(idle).not.toHaveBeenCalled();

        setNow(time += 1000);
        map.redraw();
        expect(idle).toHaveBeenCalled();
    });
});

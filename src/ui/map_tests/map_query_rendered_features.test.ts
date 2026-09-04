import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util.ts';
import {LngLat} from '../../geo/lng_lat.ts';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('queryRenderedFeatures', () => {

    test('if no arguments provided', async () => {
        const map = createMap();
        await map.once('load');
        const spy = vi.spyOn(map.style, 'queryRenderedFeatures');

        const output = map.queryRenderedFeatures();

        const args = spy.mock.calls[0];
        expect(args[0]).toBeTruthy();
        expect(args[1]).toEqual({availableImages: []});
        expect(output).toEqual([]);
    });

    test('if only "geometry" provided', async () => {
        const map = createMap();
        await map.once('load');
        const spy = vi.spyOn(map.style, 'queryRenderedFeatures');

        const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

        const args = spy.mock.calls[0];
        expect(args[0]).toEqual([{x: 100, y: 100}]); // query geometry
        expect(args[1]).toEqual({availableImages: []}); // params
        expect(args[2]).toEqual(map._camera.transform); // transform
        expect(output).toEqual([]);
    });

    test('if only "params" provided', async () => {
        const map = createMap();
        await map.once('load');
        const spy = vi.spyOn(map.style, 'queryRenderedFeatures');

        const output = map.queryRenderedFeatures({filter: ['all']});

        const args = spy.mock.calls[0];
        expect(args[0]).toBeTruthy();
        expect(args[1]).toEqual({availableImages: [], filter: ['all']});
        expect(output).toEqual([]);
    });

    test('if both "geometry" and "params" provided', async () => {
        const map = createMap();
        await map.once('load');
        const spy = vi.spyOn(map.style, 'queryRenderedFeatures');

        const output = map.queryRenderedFeatures({filter: ['all']});

        const args = spy.mock.calls[0];
        expect(args[0]).toBeTruthy();
        expect(args[1]).toEqual({availableImages: [], filter: ['all']});
        expect(output).toEqual([]);
    });

    test('if "geometry" with unwrapped coords provided', async () => {
        const map = createMap();
        await map.once('load');
        const spy = vi.spyOn(map.style, 'queryRenderedFeatures');

        map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

        expect(spy.mock.calls[0][0]).toEqual([{x: 612, y: 100}]);
    });

    test('fires an error when geometry contains more than two points', async () => {
        const map = createMap();
        await map.once('load');
        const errorListener = vi.fn();
        map.on('error', errorListener);

        const result = map.queryRenderedFeatures([[0, 0], [10, 10], [20, 20]] as any);

        expect(result).toEqual([]);
        expect(errorListener).toHaveBeenCalledTimes(1);
        expect(errorListener.mock.calls[0][0].error.message).toBe('queryRenderedFeatures only accepts a single point or a bounding box of two points.');
    });

    test('fires an error for more than two points when no style is loaded', () => {
        const map = createMap({style: undefined});
        const errorListener = vi.fn();
        map.on('error', errorListener);

        const result = map.queryRenderedFeatures([[0, 0], [10, 10], [20, 20]] as any);

        expect(result).toEqual([]);
        expect(errorListener).toHaveBeenCalledTimes(1);
        expect(errorListener.mock.calls[0][0].error.message).toBe('queryRenderedFeatures only accepts a single point or a bounding box of two points.');
    });

    test('returns an empty array when no style is loaded', () => {
        const map = createMap({style: undefined});
        expect(map.queryRenderedFeatures()).toEqual([]);
    });

});

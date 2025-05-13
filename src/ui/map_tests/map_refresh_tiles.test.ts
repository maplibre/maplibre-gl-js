import {beforeEach, test, expect, vi, describe} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {CanonicalTileID} from '../../source/tile_id';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('Map::refreshTiles', () => {
    test('refreshTiles, non-existent source', async () => {
        const map = createMap({interactive: false});
        await map.once('style.load');

        map.addSource('source-id1', {type: 'raster', url: ''});
        const spy = vi.fn();
        map.style.sourceCaches['source-id1'].refreshTiles = spy;

        expect(() => {map.refreshTiles('source-id2', [{x: 1024, y: 1023, z: 11}]);})
            .toThrow('There is no source cache with ID "source-id2", cannot refresh tile');
        expect(spy).toHaveBeenCalledTimes(0);
    });

    test('refreshTiles, existing source', async () => {
        const map = createMap({interactive: false});
        await map.once('style.load');

        map.addSource('source-id1', {type: 'raster', url: ''});
        const spy = vi.fn();
        map.style.sourceCaches['source-id1'].refreshTiles = spy;

        map.refreshTiles('source-id1', [{x: 1024, y: 1023, z: 11}]);
        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][0]).toEqual([new CanonicalTileID(11, 1024, 1023)]);
    });

    test('refreshTiles, existing source, undefined tileIds', async () => {
        const map = createMap({interactive: false});
        await map.once('style.load');

        map.addSource('source-id1', {type: 'raster', url: ''});
        const spy = vi.fn();
        map.style.sourceCaches['source-id1'].reload = spy;

        map.refreshTiles('source-id1');
        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][0]).toBe(true);
    });
});
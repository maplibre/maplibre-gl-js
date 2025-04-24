import {beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {CanonicalTileID} from '../../source/tile_id';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('refreshTiles', async () => {
    const map = createMap({interactive: false});
    await map.once('style.load');

    map.addSource('source-id1', {type: 'raster', url: ''});
    const spy = vi.fn();
    map.style.sourceCaches['source-id1'].refreshTiles = spy;

    expect(() => {map.refreshTiles([{x: 1024, y: 1023, z: 11}], 'source-id2');})
        .toThrow('There is no source cache with ID "source-id2", cannot refresh tile');
    expect(spy).toHaveBeenCalledTimes(0);
    map.refreshTiles([{x: 1024, y: 1023, z: 11}], 'source-id1');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toEqual([new CanonicalTileID(11, 1024, 1023)]);
});

test('refreshTile', async () => {
    const map = createMap({interactive: false});
    await map.once('style.load');

    map.addSource('source-id1', {type: 'raster', url: ''});
    const spy = vi.fn();
    map.style.sourceCaches['source-id1'].refreshTiles = spy;

    expect(() => {map.refreshTile(1024, 1023, 11, 'source-id2');})
        .toThrow('There is no source cache with ID "source-id2", cannot refresh tile');
    expect(spy).toHaveBeenCalledTimes(0);
    map.refreshTile(1024, 1023, 11, 'source-id1');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toEqual([new CanonicalTileID(11, 1024, 1023)]);
});
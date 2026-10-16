import {beforeEach, test, expect, vi, describe} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';
import {ImageRequest} from '../../util/image_request.ts';
import {AJAXError} from '../../util/ajax.ts';

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
        map.style.tileManagers['source-id1'].refreshTiles = spy;

        expect(() => {map.refreshTiles('source-id2', [{x: 1024, y: 1023, z: 11}]);})
            .toThrow('There is no tile manager with ID "source-id2", cannot refresh tile');
        expect(spy).toHaveBeenCalledTimes(0);
    });

    test('refreshTiles, existing source', async () => {
        const map = createMap({interactive: false});
        await map.once('style.load');

        map.addSource('source-id1', {type: 'raster', url: ''});
        const spy = vi.fn();
        map.style.tileManagers['source-id1'].refreshTiles = spy;

        map.refreshTiles('source-id1', [{x: 1024, y: 1023, z: 11}]);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toEqual([new CanonicalTileID(11, 1024, 1023)]);
    });

    test('refreshTiles, existing source, undefined tileIds', async () => {
        const map = createMap({interactive: false});
        await map.once('style.load');

        map.addSource('source-id1', {type: 'raster', url: ''});
        const spy = vi.fn();
        map.style.tileManagers['source-id1'].reload = spy;

        map.refreshTiles('source-id1');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe(true);
    });

    test('refreshTiles with tile ids, errored raster tile, the next frame draws', async () => {
        vi.spyOn(ImageRequest, 'getImage')
            .mockResolvedValue({data: {width: 256, height: 256, close: () => {}}})
            .mockRejectedValueOnce(new AJAXError(404, 'Not Found', 'http://example.com', new Blob()));
        const map = createMap({
            style: {
                version: 8,
                sources: {demo: {type: 'raster', tiles: ['http://example.com/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 2}},
                layers: [{id: 'demo', type: 'raster', source: 'demo'}]
            },
            center: [0, 0], zoom: 2
        });
        await map.once('idle');
        const tileManager = map.style.tileManagers.demo;
        const tile = tileManager.getIds().map(id => tileManager.getTileByID(id)).find(t => t.state === 'errored');

        map.refreshTiles('demo', [tile.tileID.canonical]);

        // the tile has no texture yet, so it must not be drawn until it loads
        expect(() => map.redraw()).not.toThrow();
        await vi.waitFor(() => expect(tile.state).toBe('loaded'));
    });
});

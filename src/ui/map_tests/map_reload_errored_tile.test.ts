import {beforeEach, afterEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util.ts';
import {fakeServer, type FakeServer} from 'nise';
import {ImageRequest} from '../../util/image_request.ts';
import {AJAXError} from '../../util/ajax.ts';
import {RGBAImage} from '../../util/image.ts';
import {RasterDEMTileSource} from '../../source/raster_dem_tile_source.ts';

import type {Map} from '../map.ts';
import type {VectorTileSource} from '../../source/vector_tile_source.ts';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
    vi.restoreAllMocks();
});

const vectorTiles = ['http://example.com/{z}/{x}/{y}.pbf'];

test.each([
    ['setTiles', (map: Map) => map.getSource<VectorTileSource>('demo').setTiles(vectorTiles)],
    ['refreshTiles without tile ids', (map: Map) => map.refreshTiles('demo')]
])('an errored vector tile is requested again by %s, and the map settles', async (_, reload) => {
    // The first request for the first tile fails, every other request returns an empty tile
    const requests: string[] = [];
    server.respondImmediately = true;
    server.respondWith(request => {
        requests.push(request.url);
        const failsOnce = request.url === requests[0] && requests.filter(url => url === request.url).length === 1;
        request.respond(failsOnce ? 500 : 200, {}, '');
    });
    const map = createMap({
        style: {
            version: 8,
            sources: {demo: {type: 'vector', tiles: vectorTiles}},
            layers: [{id: 'demo', type: 'circle', source: 'demo', 'source-layer': 'sourceLayer'}]
        },
        center: [0, 0], zoom: 2
    });
    await map.once('idle');
    const idle = vi.fn();
    map.on('idle', idle);

    reload(map);

    await vi.waitFor(() => expect(idle).toHaveBeenCalled());
    expect(requests.filter(url => url === requests[0])).toHaveLength(2);
    expect(map.loaded()).toBe(true);
});

test('a raster-dem tile that errors on a reload loads on the next one', async () => {
    vi.spyOn(RasterDEMTileSource.prototype, 'readImageNow').mockResolvedValue(new RGBAImage({width: 256, height: 256}));
    const getImage = vi.spyOn(ImageRequest, 'getImage').mockResolvedValue({data: {width: 256, height: 256, close: () => {}}});
    const map = createMap({
        style: {
            version: 8,
            sources: {dem: {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 2}},
            layers: [{id: 'hill', type: 'hillshade', source: 'dem'}]
        },
        center: [0, 0], zoom: 2
    });
    await map.once('idle');
    const tileManager = map.style.tileManagers.dem;
    const tile = tileManager.getTileByID(tileManager.getIds()[0]);
    expect(tile.state).toBe('loaded');

    getImage.mockRejectedValueOnce(new AJAXError(500, 'Server Error', 'http://example.com', new Blob()));
    map.refreshTiles('dem', [tile.tileID.canonical]);
    await vi.waitFor(() => expect(tile.state).toBe('errored'));

    map.refreshTiles('dem');
    await vi.waitFor(() => expect(tile.state).toBe('loaded'));
});

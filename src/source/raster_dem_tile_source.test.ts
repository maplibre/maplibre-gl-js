import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {fakeServer, type FakeServer} from 'nise';
import {RasterDEMTileSource} from './raster_dem_tile_source.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {RequestManager} from '../util/request_manager.ts';
import {ImageRequest} from '../util/image_request.ts';
import {Tile} from '../tile/tile.ts';
import {DEMData} from '../data/dem_data.ts';
import {RGBAImage} from '../util/image.ts';
import {getMockDispatcher} from '../util/test/util.ts';
import {sleep, waitForEvent, waitForMetadataEvent} from '../util/test/util.ts';
import type {MapSourceDataEvent} from '../ui/events.ts';

function createSource(options, transformCallback?) {
    const source = new RasterDEMTileSource('id', options, getMockDispatcher(), options.eventedParent);
    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        getPixelRatio() { return 1; }
    } as any);

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

function createDEMData(elevations: number[][]): DEMData {
    // a DEM image carries two pixels of border on each side, filled here from the nearest inner pixel
    const dim = elevations.length;
    const stride = dim + 4;
    const pixels = new Uint8Array(stride * stride * 4);
    for (let y = 0; y < stride; y++) {
        for (let x = 0; x < stride; x++) {
            const row = elevations[Math.min(Math.max(y - 2, 0), dim - 1)];
            pixels[(y * stride + x) * 4] = row[Math.min(Math.max(x - 2, 0), dim - 1)];
            pixels[(y * stride + x) * 4 + 3] = 255;
        }
    }
    return new DEMData('dem', new RGBAImage({width: stride, height: stride}, pixels), 'custom', 1, 0, 0, 0);
}

function createDEMTile(z: number, x: number, y: number, elevations: number[][]): Tile {
    const tile = new Tile(new OverscaledTileID(z, 0, z, x, y), 512);
    tile.dem = createDEMData(elevations);
    return tile;
}

function createSourceWithTiles(inViewTiles: Tile[], outOfViewTiles: Tile[] = []): RasterDEMTileSource {
    const source = createSource({tiles: ['http://example.com/{z}/{x}/{y}.png'], minzoom: 0, maxzoom: 2});
    const find = (tiles: Tile[], key: string) => tiles.find((tile) => tile.tileID.key === key);
    source.map.style = {tileManagers: {id: {
        getTileByID: (key: string) => find(inViewTiles, key),
        _outOfViewCache: {getByKey: (key: string) => find(outOfViewTiles, key)}
    }}} as any;
    return source;
}

describe('RasterDEMTileSource', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });

    afterEach(() => {
        server.restore();
        vi.restoreAllMocks();
    });

    test('transforms request for TileJSON URL', () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));
        const transformSpy = vi.fn().mockImplementation((url) => {
            return {url};
        });

        createSource({url: '/source.json'}, transformSpy);
        server.respond();

        expect(transformSpy.mock.calls[0][0]).toBe('/source.json');
        expect(transformSpy.mock.calls[0][1]).toBe('Source');
    });

    test('can asynchronously transform request for TileJSON URL', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: '/source.json'}, async (url) => ({
            url,
            headers: {Authorization: 'Bearer token'}
        }));
        const promise = waitForMetadataEvent(source);
        await sleep(0);
        server.respond();
        await promise;
        expect(server.requests[0].url).toBe('/source.json');
        expect(server.requests[0].requestHeaders.Authorization).toBe('Bearer token');
    });

    test('transforms tile urls and requests them without color space conversion', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: '/source.json'});
        const transformSpy = vi.spyOn(source.map._requestManager, 'transformRequest');
        const image = await createImageBitmap(new ImageData(16, 16));
        const getImageSpy = vi.spyOn(ImageRequest, 'getImage').mockResolvedValue({data: image});
        const promise = waitForMetadataEvent(source);
        await sleep(0);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData () {},
            setExpiryData() {},
            actor: 1
        } as any as Tile;
        await source.loadTile(tile);

        expect(transformSpy).toHaveBeenCalledTimes(1);
        expect(transformSpy.mock.calls[0][0]).toBe('http://example.com/10/5/5.png');
        expect(transformSpy.mock.calls[0][1]).toBe('Tile');
        expect(getImageSpy.mock.calls[0][3]).toEqual({colorSpaceConversion: 'none'});
    });

    test('an empty tile response loads as a tile without DEM data', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }));
        const source = createSource({url: '/source.json'});
        vi.spyOn(ImageRequest, 'getImage').mockResolvedValue({data: null});
        const promise = waitForMetadataEvent(source);
        await sleep(0);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData () {},
            setExpiryData() {},
            actor: {sendAsync: vi.fn()}
        } as any as Tile;
        await source.loadTile(tile);

        expect(tile.state).toBe('loaded');
        expect(tile.dem).toBeUndefined();
        expect((tile.actor as any).sendAsync).not.toHaveBeenCalled();
    });

    test('can asynchronously transform tile request', async () => {
        server.respondWith('http://example.com/10/5/5.png',
            [200, {'Content-Type': 'image/png', 'Content-Length': 1, 'Cache-Control': 'max-age=100'}, '0']
        );

        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }, async (url) => ({
            url,
            headers: {Authorization: 'Bearer token'}
        }));
        source.map.painter = {context: {}, getTileTexture: () => { return {update: () => {}}; }} as any;
        await waitForMetadataEvent(source);

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {},
            actor: 1
        } as any as Tile;
        const promise = source.loadTile(tile);
        await sleep(0);
        server.respond();
        await promise;
        expect(server.requests[0].url).toBe('http://example.com/10/5/5.png');
        expect(server.requests[0].requestHeaders.Authorization).toBe('Bearer token');
    });

    test('populates neighboringTiles', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }));
        const source = createSource({url: '/source.json'});
        const promise = waitForMetadataEvent(source);
        await sleep(0);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData () {},
            setExpiryData() {}
        } as any as Tile;
        source.loadTile(tile);
        await sleep(0);

        expect(Object.keys(tile.neighboringTiles)).toEqual([
            new OverscaledTileID(10, 0, 10, 4, 5).key,
            new OverscaledTileID(10, 0, 10, 6, 5).key,
            new OverscaledTileID(10, 0, 10, 4, 4).key,
            new OverscaledTileID(10, 0, 10, 5, 4).key,
            new OverscaledTileID(10, 0, 10, 6, 4).key,
            new OverscaledTileID(10, 0, 10, 4, 6).key,
            new OverscaledTileID(10, 0, 10, 5, 6).key,
            new OverscaledTileID(10, 0, 10, 6, 6).key
        ]);
    });

    test('populates neighboringTiles with wrapped tiles', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }));

        const source = createSource({url: '/source.json'});
        const promise = waitForMetadataEvent(source);

        await sleep(0);
        server.respond();
        await promise;

        const tile = {
            tileID: new OverscaledTileID(5, 0, 5, 31, 5),
            state: 'loading',
            loadVectorData() {},
            setExpiryData() {}
        } as any as Tile;
        source.loadTile(tile);
        await sleep(0);

        expect(Object.keys(tile.neighboringTiles)).toEqual([
            new OverscaledTileID(5, 0, 5, 30, 6).key,
            new OverscaledTileID(5, 0, 5, 31, 6).key,
            new OverscaledTileID(5, 0, 5, 30, 5).key,
            new OverscaledTileID(5, 1, 5, 0,  5).key,
            new OverscaledTileID(5, 0, 5, 30, 4).key,
            new OverscaledTileID(5, 0, 5, 31, 4).key,
            new OverscaledTileID(5, 1, 5, 0,  4).key,
            new OverscaledTileID(5, 1, 5, 0,  6).key
        ]);
    });

    test('serializes options', () => {
        const source = createSource({
            tiles: ['http://localhost:2900/raster-dem/{z}/{x}/{y}.png'],
            minzoom: 2,
            maxzoom: 10
        });
        expect(source.serialize()).toStrictEqual({
            type: 'raster-dem',
            tiles: ['http://localhost:2900/raster-dem/{z}/{x}/{y}.png'],
            minzoom: 2,
            maxzoom: 10
        });
    });

    test('Tile expiry data is set when "Cache-Control" is set but not "Expires"', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        server.respondWith('http://example.com/10/5/5.png',
            [200, {'Content-Type': 'image/png', 'Content-Length': 1, 'Cache-Control': 'max-age=100'}, '0']
        );
        const source = createSource({url: '/source.json'});
        source.map.painter = {context: {}, getTileTexture: () => ({update: () => {}})} as any;
        source.map._refreshExpiredTiles = true;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await sleep(0);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {},
            actor: source.dispatcher.getReadyActor()
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        await sleep(0);
        server.respond();
        await tilePromise;
        expect(expiryDataSpy).toHaveBeenCalledTimes(1);
    });

    test('Tile expiry data is set when "Expires" is set but not "Cache-Control"', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        server.respondWith('http://example.com/10/5/5.png',
            [200, {'Content-Type': 'image/png', 'Content-Length': 1, 'Expires': 'Wed, 21 Oct 2015 07:28:00 GMT'}, '0']
        );
        const source = createSource({url: '/source.json'});
        source.map.painter = {context: {}, getTileTexture: () => ({update: () => {}})} as any;
        source.map._refreshExpiredTiles = true;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await sleep(0);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {},
            actor: source.dispatcher.getReadyActor()
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        await sleep(0);
        server.respond();
        await tilePromise;
        expect(expiryDataSpy).toHaveBeenCalledTimes(1);
    });

    test('Tile expiry data is set when "Expires" is set and "Cache-Control" is an empty string', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        server.respondWith('http://example.com/10/5/5.png',
            [200, {'Content-Type': 'image/png', 'Content-Length': 1, 'Cache-Control': '', 'Expires': 'Wed, 21 Oct 2015 07:28:00 GMT'}, '0']
        );
        const source = createSource({url: '/source.json'});
        source.map.painter = {context: {}, getTileTexture: () => ({update: () => {}})} as any;
        source.map._refreshExpiredTiles = true;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await sleep(0);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {},
            actor: source.dispatcher.getReadyActor()
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        await sleep(0);
        server.respond();
        await tilePromise;
        expect(expiryDataSpy).toHaveBeenCalledTimes(1);
    });

    test('does not request a tile that was aborted while its request was being transformed', async () => {
        let releaseTransform: (params: {url: string}) => void;
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }, (url, type) => {
            if (type !== 'Tile') return {url};
            return new Promise<{url: string}>((resolve) => {
                releaseTransform = resolve;
            });
        });
        source.tiles = ['http://example.com/{z}/{x}/{y}.png'];

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {}
        } as any as Tile;

        const loadPromise = source.loadTile(tile);
        tile.aborted = true;
        await source.abortTile(tile);
        releaseTransform({url: 'http://example.com/10/5/5.png'});
        await expect(loadPromise).resolves.toBeUndefined();

        expect(server.requests).toHaveLength(0);
        expect(tile.state).toBe('unloaded');
    });

    test('does not throw when tile is aborted', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }));

        const source = createSource({url: '/source.json'});
        const promise = waitForMetadataEvent(source);

        await sleep(0);
        server.respond();
        await promise;

        const tile = {
            tileID: new OverscaledTileID(5, 0, 5, 31, 5),
            state: 'loading',
            loadVectorData() {},
            setExpiryData() {}
        } as any as Tile;
        const loadPromise = source.loadTile(tile);
        await sleep(0);

        tile.abortController.abort();
        tile.aborted = true;

        await expect(loadPromise).resolves.toBeUndefined();
        expect(tile.state).toBe('unloaded');
    });

    test('reloads tile in reloading state', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }));
        server.respondWith('http://example.com/5/31/5.png',
            [200, {'Content-Type': 'image/png', 'Content-Length': 1}, '0']
        );

        const source = createSource({url: '/source.json'});
        const promise = waitForMetadataEvent(source);

        await sleep(0);
        server.respond();
        await promise;

        const tile = {
            tileID: new OverscaledTileID(5, 0, 5, 31, 5),
            state: 'reloading',
            actor: source.dispatcher.getReadyActor(),
            loadVectorData() {},
            setExpiryData() {}
        } as any as Tile;
        const tilePromise = source.loadTile(tile);
        await sleep(0);
        server.respond();
        await tilePromise;
        expect(tile.state).toBe('loaded');
    });

    describe('queryElevations', () => {
        test('returns null before the source is on a map', () => {
            const source = new RasterDEMTileSource('id', {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']}, getMockDispatcher(), undefined);

            expect(source.queryElevations([[0, 0]])).toEqual([null]);
        });

        test('returns null where no DEM tile is loaded', () => {
            const source = createSourceWithTiles([]);

            expect(source.queryElevations([[0, 0]])).toEqual([null]);
        });

        test('interpolates between the DEM pixels around the location', () => {
            const source = createSourceWithTiles([createDEMTile(0, 0, 0, [
                [0, 1, 2, 3],
                [0, 1, 2, 3],
                [0, 1, 2, 3],
                [0, 1, 2, 3]
            ])]);

            // longitude 45 is 5/8 of the way across the world tile, which lands halfway between pixel columns 2 and 3
            expect(source.queryElevations([[45, 0]])).toEqual([{elevation: 2.5, tileZoom: 0}]);
        });

        test('reads the highest loaded zoom at each location', () => {
            const source = createSourceWithTiles([
                createDEMTile(0, 0, 0, [[50]]),
                createDEMTile(2, 0, 2, [[200]])
            ]);

            expect(source.queryElevations([[-135, 0], [45, 0]])).toEqual([
                {elevation: 200, tileZoom: 2},
                {elevation: 50, tileZoom: 0}
            ]);
        });

        test('reads tiles that left the view but are still cached', () => {
            const source = createSourceWithTiles([], [createDEMTile(1, 1, 0, [[120]])]);

            expect(source.queryElevations([[45, 45]])).toEqual([{elevation: 120, tileZoom: 1}]);
        });
    });
});

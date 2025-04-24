import {describe, beforeEach, afterEach, test, expect, vi, it} from 'vitest';
import {fakeServer, type FakeServer} from 'nise';
import {RasterDEMTileSource} from './raster_dem_tile_source';
import {OverscaledTileID} from './tile_id';
import {RequestManager} from '../util/request_manager';
import {type Tile} from './tile';
import {waitForEvent, waitForMetadataEvent} from '../util/test/util';
import type {MapSourceDataEvent} from '../ui/events';

function createSource(options, transformCallback?) {
    const source = new RasterDEMTileSource('id', options, {} as any, options.eventedParent);
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

describe('RasterDEMTileSource', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });

    afterEach(() => {
        server.restore();
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

    test('transforms tile urls before requesting', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: '/source.json'});
        const transformSpy = vi.spyOn(source.map._requestManager, 'transformRequest');
        const promise = waitForMetadataEvent(source);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData () {},
            setExpiryData() {}
        } as any as Tile;
        source.loadTile(tile);

        expect(transformSpy).toHaveBeenCalledTimes(1);
        expect(transformSpy.mock.calls[0][0]).toBe('http://example.com/10/5/5.png');
        expect(transformSpy.mock.calls[0][1]).toBe('Tile');
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
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData () {},
            setExpiryData() {}
        } as any as Tile;
        source.loadTile(tile);

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

        server.respond();
        await promise;

        const tile = {
            tileID: new OverscaledTileID(5, 0, 5, 31, 5),
            state: 'loading',
            loadVectorData() {},
            setExpiryData() {}
        } as any as Tile;
        source.loadTile(tile);

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

    it('serializes options', () => {
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
        source.map.painter = {context: {}, getTileTexture: () => { return {update: () => {}}; }} as any;
        source.map._refreshExpiredTiles = true;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {},
            actor: 1
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
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
        source.map.painter = {context: {}, getTileTexture: () => { return {update: () => {}}; }} as any;
        source.map._refreshExpiredTiles = true;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {},
            actor: 1
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
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
        source.map.painter = {context: {}, getTileTexture: () => { return {update: () => {}}; }} as any;
        source.map._refreshExpiredTiles = true;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {},
            actor: 1
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        server.respond();
        await tilePromise;
        expect(expiryDataSpy).toHaveBeenCalledTimes(1);
    });
});

import {describe, beforeEach, afterEach, test, expect, vi, it} from 'vitest';
import {RasterTileSource} from './raster_tile_source';
import {OverscaledTileID} from '../tile/tile_id';
import {RequestManager} from '../util/request_manager';
import {type Dispatcher} from '../util/dispatcher';
import {fakeServer, type FakeServer} from 'nise';
import {type Tile} from '../tile/tile';
import {stubAjaxGetImage, waitForEvent} from '../util/test/util';
import {type MapSourceDataEvent} from '../ui/events';
import * as loadTileJSONModule from './load_tilejson';

function isAbortPendingTileRequestsEvent(e: any): boolean {
    return e?.abortPendingTileRequests === true || e?.data?.abortPendingTileRequests === true;
}

function createSource(options, transformCallback?) {
    const source = new RasterTileSource('id', options, {send() {}} as any as Dispatcher, options.eventedParent);
    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        getPixelRatio() { return 1; }
    } as any);

    source.on('error', () => { }); // to prevent console log of errors

    return source;
}

describe('RasterTileSource', () => {
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
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
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

    test('fires "error" event if TileJSON request fails', async () => {
        server.respondWith('/source.json', [404, {}, '']);

        const source = createSource({url: '/source.json'});
        const errorEvent = waitForEvent(source, 'error', (e) => e.error.status === 404);
        server.respond();

        await expect(errorEvent).resolves.toBeDefined();
        expect(source.loaded()).toBe(true);
    });

    test('respects TileJSON.bounds', async () => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        });

        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
        expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
    });

    test('does not error on invalid bounds', async () => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, 91]
        });

        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        expect(source.tileBounds.bounds).toEqual({_sw: {lng: -47, lat: -7}, _ne: {lng: -45, lat: 90}});
    });

    test('respects TileJSON.bounds when loaded from TileJSON', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: '/source.json'});

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        server.respond();

        await promise;
        expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
        expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
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
        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
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

    test('HttpImageElement used to get image when refreshExpiredTiles is false', async () => {
        stubAjaxGetImage(undefined);
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: '/source.json'});
        source.map.painter = {context: {}, getTileTexture: () => { return {update: () => {}}; }} as any;
        source.map._refreshExpiredTiles = false;

        const imageConstructorSpy = vi.spyOn(global, 'Image');
        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading'
        } as any as Tile;
        await source.loadTile(tile);
        expect(imageConstructorSpy).toHaveBeenCalledTimes(1);
        expect(tile.state).toBe('loaded');
    });

    test('supports updating tiles', () => {
        const source = createSource({url: '/source.json'});
        source.setTiles(['http://example.com/{z}/{x}/{y}.png?updated=true']);

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.tiles[0]).toBe('http://example.com/{z}/{x}/{y}.png?updated=true');
            }
        });
    });

    test('cancels TileJSON request if removed', () => {
        const source = createSource({url: '/source.json'});
        source.onRemove();
        expect((server.lastRequest as any).aborted).toBe(true);
    });

    test('supports url property updates', async () => {
        server.respondWith('http://localhost:2900/source2.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));

        const source = createSource({
            url: 'http://localhost:2900/source.json'
        });
        const errorHandler = vi.fn();
        source.on('error', errorHandler);
        source.setUrl('http://localhost:2900/source2.json');

        server.respond();

        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        expect(server.requests.length).toBe(2);
        expect(server.requests[0].aborted).toBe(true);
        expect(source.serialize()).toEqual({
            type: 'raster',
            url: 'http://localhost:2900/source2.json'
        });
        expect(errorHandler).not.toHaveBeenCalled();
    });

    it('serializes options', () => {
        const source = createSource({
            tiles: ['http://localhost:2900/raster/{z}/{x}/{y}.png'],
            minzoom: 2,
            maxzoom: 10
        });
        expect(source.serialize()).toStrictEqual({
            type: 'raster',
            tiles: ['http://localhost:2900/raster/{z}/{x}/{y}.png'],
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
            setExpiryData() {}
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        server.respond();
        await tilePromise;
        expect(tile.state).toBe('loaded');
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
            setExpiryData() {}
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        server.respond();
        await tilePromise;
        expect(tile.state).toBe('loaded');
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
            setExpiryData() {}
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        server.respond();
        await tilePromise;
        expect(tile.state).toBe('loaded');
        expect(expiryDataSpy).toHaveBeenCalledTimes(1);
    });

    test('does not throw when tile is aborted', async () => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        });

        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        const tile = {
            tileID: new OverscaledTileID(5, 0, 5, 31, 5),
            state: 'loading',
            loadVectorData() {},
            setExpiryData() {}
        } as any as Tile;
        const loadPromise = source.loadTile(tile);

        tile.abortController.abort();
        tile.aborted = true;

        await expect(loadPromise).resolves.toBeUndefined();
        expect(tile.state).toBe('unloaded');
    });

    test('loads tile after previous abort flag was set', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        server.respondWith('http://example.com/10/5/5.png',
            [200, {'Content-Type': 'image/png', 'Content-Length': 1}, '0']
        );

        const source = createSource({url: '/source.json'});
        source.map.painter = {context: {}, getTileTexture: () => ({update: () => {}})} as any;

        const sourcePromise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        server.respond();
        await sourcePromise;

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            aborted: true,
            setExpiryData() {}
        } as any as Tile;

        expect(tile.aborted).toBe(true);

        const tilePromise = source.loadTile(tile);
        server.respond();
        await tilePromise;

        expect(tile.state).toBe('loaded');
        expect(tile.aborted).toBe(false);
    });

    test('setSourceProperty emits abortPendingTileRequests before callback and load(true)', () => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        const onData = vi.fn();
        source.on('data', onData);

        const callback = vi.fn();
        const loadSpy = vi.spyOn(source, 'load');

        source.setSourceProperty(callback);

        const abortEventIndex = onData.mock.calls.findIndex(([e]) => isAbortPendingTileRequestsEvent(e));
        expect(abortEventIndex).toBeGreaterThan(-1);

        const abortEventOrder = onData.mock.invocationCallOrder[abortEventIndex];
        const callbackOrder = callback.mock.invocationCallOrder[0];
        const loadOrder = loadSpy.mock.invocationCallOrder[0];

        expect(abortEventOrder).toBeLessThan(callbackOrder);
        expect(callbackOrder).toBeLessThan(loadOrder);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(loadSpy).toHaveBeenCalledWith(true);
    });

    test('setUrl emits abortPendingTileRequests and calls load(true)', () => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });

        const loadSpy = vi.spyOn(source, 'load');
        const events: Array<any> = [];
        source.on('data', (e: any) => events.push(e));

        source.setUrl('http://localhost:2900/source2.json');

        expect(
            events.some((e) => isAbortPendingTileRequestsEvent(e))
        ).toBe(true);
        expect(source.url).toBe('http://localhost:2900/source2.json');
        expect(loadSpy).toHaveBeenCalledWith(true);
    });

    test('load ignores AbortError from TileJSON request', async () => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });

        const abortError = new Error('aborted');
        (abortError as any).name = 'AbortError';
        vi.spyOn(loadTileJSONModule, 'loadTileJson').mockRejectedValueOnce(abortError);

        const onError = vi.fn();
        source.on('error', onError);

        await source.load(true);

        expect(onError).not.toHaveBeenCalled();
    });

    test('load emits error event when TileJSON is malformed (parser rejection)', async () => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });

        vi.spyOn(loadTileJSONModule, 'loadTileJson').mockRejectedValueOnce(new Error('Invalid TileJSON payload'));

        const onError = vi.fn();
        source.on('error', onError);

        await source.load(true);

        expect(onError).toHaveBeenCalledTimes(1);
    });

});

import {describe, beforeEach, afterEach, test, expect, vi, it} from 'vitest';
import {RasterTileSource} from './raster_tile_source.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {RequestManager} from '../util/request_manager.ts';
import {type Dispatcher} from '../util/dispatcher.ts';
import {fakeServer, type FakeServer} from 'nise';
import {type Tile} from '../tile/tile.ts';
import {sleep, stubAjaxGetImage, waitForEvent} from '../util/test/util.ts';
import {type MapSourceDataEvent} from '../ui/events.ts';
import {ImageRequest} from '../util/image_request.ts';
import {AbortError} from '../util/abort_error.ts';

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

// Requests that stay in flight until settled by hand; started[n] resolves once the n-th is issued.
function stubSettlableImageRequests(count: number) {
    const controllers: AbortController[] = [];
    const settlers: Array<{resolve: (response: any) => void; reject: (error: Error) => void}> = [];
    const issued: Array<() => void> = [];
    const started = Array.from({length: count}, () => new Promise<void>((resolve) => issued.push(resolve)));

    vi.spyOn(ImageRequest, 'getImage').mockImplementation((_request, abortController) => {
        controllers.push(abortController);
        issued[controllers.length - 1]?.();
        return new Promise((resolve, reject) => {
            settlers.push({resolve, reject});
        });
    });

    return {controllers, settlers, started};
}

describe('RasterTileSource', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        server.restore();
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

    test('can asynchronously transform request for TileJSON URL', async () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: '/source.json'}, async (url) => ({
            url,
            headers: {Authorization: 'Bearer token'}
        }));
        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await sleep(0);
        server.respond();
        await promise;
        expect(server.requests[0].url).toBe('/source.json');
        expect(server.requests[0].requestHeaders.Authorization).toBe('Bearer token');
    });

    test('fires "error" event if TileJSON request fails', async () => {
        server.respondWith('/source.json', [404, {}, '']);

        const source = createSource({url: '/source.json'});
        const errorEvent = waitForEvent(source, 'error', (e) => e.error.status === 404);
        await sleep(0);
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
        await sleep(0);
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
        expect(transformSpy).toHaveBeenCalledTimes(1);
        expect(transformSpy.mock.calls[0][0]).toBe('http://example.com/10/5/5.png');
        expect(transformSpy.mock.calls[0][1]).toBe('Tile');
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
        source.map.painter = {context: {}, getTileTexture: () => ({update: () => {}})} as any;
        await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData () {},
            setExpiryData() {}
        } as any as Tile;
        const promise = source.loadTile(tile);
        await sleep(0);
        server.respond();
        await promise;
        expect(server.requests[0].url).toBe('http://example.com/10/5/5.png');
        expect(server.requests[0].requestHeaders.Authorization).toBe('Bearer token');
        expect(tile.state).toBe('loaded');
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
        source.map.painter = {context: {}, getTileTexture: () => ({update: () => {}})} as any;
        source.map._refreshExpiredTiles = false;

        const imageConstructorSpy = vi.spyOn(global, 'Image');
        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await sleep(0);
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

    test('cancels TileJSON request if removed', async () => {
        const source = createSource({url: '/source.json'});
        await sleep(0);
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
        await sleep(0);
        const errorHandler = vi.fn();
        source.on('error', errorHandler);
        source.setUrl('http://localhost:2900/source2.json');

        await sleep(0);
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

    test('does not serialize runtime premultiplyAlpha setting', () => {
        const source = createSource({
            tiles: ['http://localhost:2900/raster/{z}/{x}/{y}.png']
        });
        source.setPremultiplyAlpha(false);

        expect(source.serialize()).toStrictEqual({
            type: 'raster',
            tiles: ['http://localhost:2900/raster/{z}/{x}/{y}.png']
        });
    });

    test('setPremultiplyAlpha reloads source content when changed', async () => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        const initialDataEvent: MapSourceDataEvent = await waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'content');
        expect(initialDataEvent.sourceDataChanged).toBe(false);

        const dataEvent = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'content' && e.sourceDataChanged === true);

        expect(source.setPremultiplyAlpha(false)).toBe(source);

        await expect(dataEvent).resolves.toBeDefined();
    });

    test('loadTile uploads raster data without premultiplication after setPremultiplyAlpha(false)', async () => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        source.setPremultiplyAlpha(false);
        source.tiles = ['http://example.com/{z}/{x}/{y}.png'];
        source.map._refreshExpiredTiles = false;

        const image = {width: 256, height: 256} as ImageBitmap;
        const getImageSpy = vi.spyOn(ImageRequest, 'getImage').mockResolvedValue({data: image});
        const update = vi.fn();
        source.map.painter = {
            context: {gl: {}},
            getTileTexture: () => ({update})
        } as any;

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {}
        } as any as Tile;

        await source.loadTile(tile);

        expect(getImageSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(AbortController),
            false,
            {premultiplyAlpha: 'none'}
        );
        expect(update).toHaveBeenCalledWith(image, {useMipmap: true, premultiply: false});
        expect(tile.state).toBe('loaded');
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
            setExpiryData() {}
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        await sleep(0);
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
        source.map.painter = {context: {}, getTileTexture: () => ({update: () => {}})} as any;
        source.map._refreshExpiredTiles = true;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await sleep(0);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {}
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        await sleep(0);
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
        source.map.painter = {context: {}, getTileTexture: () => ({update: () => {}})} as any;
        source.map._refreshExpiredTiles = true;

        const promise = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
        await sleep(0);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {}
        } as any as Tile;
        const expiryDataSpy = vi.spyOn(tile, 'setExpiryData');
        const tilePromise = source.loadTile(tile);
        await sleep(0);
        server.respond();
        await tilePromise;
        expect(tile.state).toBe('loaded');
        expect(expiryDataSpy).toHaveBeenCalledTimes(1);
    });

    test('does not start the request when the tile is aborted during an async transformRequest', async () => {
        let transformStarted: () => void;
        const transformCalled = new Promise<void>((resolve) => {
            transformStarted = resolve;
        });
        let releaseTransform: (params: {url: string}) => void;
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }, (url, type) => {
            if (type !== 'Tile') return {url};
            transformStarted();
            return new Promise<{url: string}>((resolve) => {
                releaseTransform = resolve;
            });
        });
        source.tiles = ['http://example.com/{z}/{x}/{y}.png'];

        const getImageSpy = vi.spyOn(ImageRequest, 'getImage').mockImplementation(async () => {
            return {data: {width: 256, height: 256} as ImageBitmap};
        });

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {}
        } as any as Tile;

        const loadPromise = source.loadTile(tile);
        await transformCalled; // loadTile is suspended in the transform
        tile.aborted = true;
        await source.abortTile(tile); // the abort lands during that suspension
        releaseTransform({url: 'http://example.com/10/5/5.png'});
        await expect(loadPromise).resolves.toBeUndefined();

        expect(getImageSpy).not.toHaveBeenCalled();
        expect(tile.state).toBe('unloaded');
    });

    test('aborts the exact request it handed to ImageRequest', async () => {
        const source = createSource({tiles: ['http://example.com/{z}/{x}/{y}.png']});
        source.tiles = ['http://example.com/{z}/{x}/{y}.png'];
        const {controllers, settlers, started} = stubSettlableImageRequests(1);

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {}
        } as any as Tile;

        const load = source.loadTile(tile);
        await started[0];

        expect(controllers).toHaveLength(1);
        expect(controllers[0].signal.aborted).toBe(false);

        tile.aborted = true;
        await source.abortTile(tile);
        settlers[0].reject(new AbortError()); // what a real aborted request does

        await expect(load).resolves.toBeUndefined();
        expect(controllers[0].signal.aborted).toBe(true);
        expect(tile.state).toBe('unloaded');
    });

    test('a superseded tile load does not disarm the load that replaced it', async () => {
        const source = createSource({tiles: ['http://example.com/{z}/{x}/{y}.png']});
        source.tiles = ['http://example.com/{z}/{x}/{y}.png'];
        source.map.painter = {
            context: {gl: {}},
            getTileTexture: () => ({update: vi.fn()})
        } as any;
        const {controllers, settlers, started} = stubSettlableImageRequests(2);

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {}
        } as any as Tile;

        const first = source.loadTile(tile);
        await started[0];
        const second = source.loadTile(tile); // a reload supersedes the first
        await started[1];

        settlers[0].resolve({data: {width: 256, height: 256} as ImageBitmap});
        await first;

        expect(controllers).toHaveLength(2);
        expect(tile.abortController).toBe(controllers[1]);
        expect(tile.state).toBe('loading');

        settlers[1].resolve({data: {width: 256, height: 256} as ImageBitmap});
        await second;

        expect(tile.state).toBe('loaded');
    });

    test('a superseded tile load that fails does not error the load that replaced it', async () => {
        const source = createSource({tiles: ['http://example.com/{z}/{x}/{y}.png']});
        source.tiles = ['http://example.com/{z}/{x}/{y}.png'];
        source.map.painter = {
            context: {gl: {}},
            getTileTexture: () => ({update: vi.fn()})
        } as any;
        const {controllers, settlers, started} = stubSettlableImageRequests(2);

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            setExpiryData() {}
        } as any as Tile;

        const first = source.loadTile(tile);
        await started[0];
        const second = source.loadTile(tile);
        await started[1];

        settlers[0].reject(new Error('the superseded request failed'));

        await expect(first).resolves.toBeUndefined();
        expect(tile.abortController).toBe(controllers[1]);
        expect(tile.state).toBe('loading');

        settlers[1].resolve({data: {width: 256, height: 256} as ImageBitmap});
        await second;

        expect(tile.state).toBe('loaded');
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
        await sleep(0);

        tile.abortController.abort();
        tile.aborted = true;

        await expect(loadPromise).resolves.toBeUndefined();
        expect(tile.state).toBe('unloaded');
    });
});

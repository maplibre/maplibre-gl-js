import {describe, beforeEach, afterEach, test, expect, vi, type Mock} from 'vitest';
import {ImageSource} from './image_source.ts';
import {extend, MAX_TILE_ZOOM} from '../util/util.ts';
import {type FakeServer, fakeServer} from 'nise';
import {beforeMapTest, createMap, sleep, stubAjaxGetImage, waitForEvent} from '../util/test/util.ts';
import {Tile} from '../tile/tile.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {ImageRequest} from '../util/image_request.ts';
import {AbortError} from '../util/abort_error.ts';
import type {Texture} from '../webgl/texture.ts';
import type {ImageSourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {MapSourceDataEvent} from '../ui/events.ts';
import type {Map} from '../ui/map.ts';

function createSource(options) {
    options = extend({
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }, options);

    return new ImageSource('id', options, {} as any, options.eventedParent);
}

// Requests that stay in flight until aborted; started[n] resolves once the n-th is issued.
function stubInFlightImageRequests(count: number) {
    const controllers: AbortController[] = [];
    const issued: Array<() => void> = [];
    const started = Array.from({length: count}, () => new Promise<void>((resolve) => issued.push(resolve)));

    vi.spyOn(ImageRequest, 'getImage').mockImplementation((_request, abortController) => {
        controllers.push(abortController);
        issued[controllers.length - 1]?.();
        return new Promise<never>((_resolve, reject) => {
            abortController.signal.addEventListener('abort', () => reject(new AbortError()));
        });
    });

    return {controllers, started};
}

describe('ImageSource', () => {
    stubAjaxGetImage(undefined);
    let server: FakeServer;
    let map: Map;

    beforeEach(() => {
        beforeMapTest();
        global.fetch = null;
        server = fakeServer.create();
        server.respondWith(new ArrayBuffer(1));
        server.respondWith('/missing-image.png', [404, {}, '']);
        map = createMap({style: null});
    });

    afterEach(() => {
        map.remove();
        vi.restoreAllMocks();
    });

    test('constructor', () => {
        const source = createSource({url: '/image.png'});

        expect(source.minzoom).toBe(0);
        expect(source.maxzoom).toBe(22);
        expect(source.tileSize).toBe(512);
    });

    test('fires dataloading event', async () => {
        const source = createSource({url: '/image.png'});
        source.on('dataloading', (e) => {
            expect(e.dataType).toBe('source');
        });
        source.onAdd(map);
        await sleep(0);
        server.respond();
        await sleep(0);
        expect(source.image).toBeTruthy();
    });

    test('does not start the request when the source is aborted during an async transformRequest', async () => {
        const source = createSource({url: '/image.png'});
        let transformStarted: () => void;
        const transformCalled = new Promise<void>((resolve) => {
            transformStarted = resolve;
        });
        let releaseTransform: (params: {url: string}) => void;
        map.setTransformRequest(() => {
            transformStarted();
            return new Promise<{url: string}>((resolve) => {
                releaseTransform = resolve;
            });
        });
        const getImageSpy = vi.spyOn(ImageRequest, 'getImage').mockImplementation(async () => {
            return {data: new ImageBitmap()};
        });
        const metadata = vi.fn();
        source.on('data', (e: MapSourceDataEvent) => {
            if (e.sourceDataType === 'metadata') metadata();
        });

        source.map = map;
        const load = source.load();
        await transformCalled; // load() is suspended in the transform
        source.onRemove(); // the abort lands during that suspension
        releaseTransform({url: '/image.png'});
        await load;

        expect(getImageSpy).not.toHaveBeenCalled();
        expect(source.image).toBeUndefined();
        expect(metadata).not.toHaveBeenCalled();
        // Nothing succeeds the torn-down load, so it finishes its own bookkeeping.
        expect(source.loaded()).toBe(true);
    });

    test('transforms url request', () => {
        const transformRequest = vi.fn((url: string, _resourceType?: string) => ({url}));
        const source = createSource({url: '/image.png'});
        map.setTransformRequest(transformRequest);
        source.onAdd(map);
        server.respond();
        expect(transformRequest).toHaveBeenCalledTimes(1);
        expect(transformRequest.mock.calls[0][0]).toBe('/image.png');
        expect(transformRequest.mock.calls[0][1]).toBe('Image');
    });

    test('can asynchronously transform request', async () => {
        const source = createSource({url: '/image.png'});
        map.setTransformRequest(async (url) => ({
            url,
            headers: {Authorization: 'Bearer token'}
        }));
        const promise = source.once('data');
        source.onAdd(map);
        await sleep(0);
        server.respond();
        await promise;
        expect(server.requests[0].url).toBe('/image.png');
        expect(server.requests[0].requestHeaders['Authorization']).toBe('Bearer token');
    });

    test('updates url from updateImage', () => {
        const transformRequest = vi.fn((url: string, _resourceType?: string) => ({url}));
        const source = createSource({url: '/image.png'});
        map.setTransformRequest(transformRequest);
        source.onAdd(map);
        server.respond();
        expect(transformRequest).toHaveBeenCalledTimes(1);
        expect(transformRequest.mock.calls[0][0]).toBe('/image.png');
        expect(transformRequest.mock.calls[0][1]).toBe('Image');
        source.updateImage({url: '/image2.png'});
        server.respond();
        expect(transformRequest).toHaveBeenCalledTimes(2);
        expect(transformRequest.mock.calls[1][0]).toBe('/image2.png');
        expect(transformRequest.mock.calls[1][1]).toBe('Image');
    });

    test('sets coordinates', () => {
        const source = createSource({url: '/image.png'});
        source.onAdd(map);
        server.respond();
        const beforeSerialized = source.serialize();
        expect(beforeSerialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
        source.setCoordinates([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
        const afterSerialized = source.serialize();
        expect(afterSerialized.coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
    });

    test('sets coordinates via updateImage', async () => {
        const source = createSource({url: '/image.png'});
        source.onAdd(map);
        server.respond();
        const beforeSerialized = source.serialize();
        expect(beforeSerialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
        source.updateImage({
            url: '/image2.png',
            coordinates: [[0, 0], [-1, 0], [-1, -1], [0, -1]]
        });
        await sleep(0);
        server.respond();
        await sleep(0);
        const afterSerialized = source.serialize();
        expect(afterSerialized.coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
    });

    test('fires data event when content is loaded', async () => {
        const source = createSource({url: '/image.png'});
        const promise = waitForEvent(source, 'data', (e) => e.dataType === 'source' && e.sourceDataType === 'content');
        source.onAdd(map);
        await sleep(0);
        server.respond();
        await promise;
        expect(typeof source.tileID == 'object').toBeTruthy();
    });

    test('fires data event when metadata is loaded', async () => {
        const source = createSource({url: '/image.png'});
        const promise = waitForEvent(source, 'data', (e) => e.dataType === 'source' && e.sourceDataType === 'metadata');
        source.onAdd(map);
        await sleep(0);
        server.respond();
        await expect(promise).resolves.toBeDefined();
    });

    test('fires idle event on prepare call when there is at least one not loaded tile', async () => {
        const source = createSource({url: '/image.png'});
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);
        const promise = waitForEvent(source, 'data', (e) => e.dataType === 'source' && e.sourceDataType === 'idle');
        source.onAdd(map);
        server.respond();

        source.tiles[String(tile.tileID.wrap)] = tile;
        source.image = new ImageBitmap();
        // assign dummies directly so we don't need to stub the gl things
        source.texture = {} as Texture;
        source.prepare();
        await promise;
        expect(tile.state).toBe('loaded');
    });

    test('serialize url and coordinates', () => {
        const source = createSource({url: '/image.png'});

        const serialized = source.serialize() as ImageSourceSpecification;
        expect(serialized.type).toBe('image');
        expect(serialized.url).toBe('/image.png');
        expect(serialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
    });

    test('allows using updateImage before initial image is loaded', async () => {
        const source = createSource({url: '/image.png', eventedParent: map});

        // Suppress errors because we're aborting when updating.
        map.on('error', () => {});
        source.onAdd(map);
        expect(source.image).toBeUndefined();
        source.updateImage({url: '/image2.png'});
        await sleep(0);
        server.respond();
        await sleep(10);

        expect(source.image).toBeTruthy();
    });

    test('cancels request if updateImage is used', async () => {
        const source = createSource({url: '/image.png', eventedParent: map});

        // Suppress errors because we're aborting.
        map.on('error', () => {});
        source.onAdd(map);
        await sleep(0);

        const spy = vi.spyOn(server.requests[0] as any, 'abort');

        source.updateImage({url: '/image2.png'});
        expect(spy).toHaveBeenCalled();
    });

    test('marks the source as loaded when the request has received a response', async () => {
        const source = createSource({url: '/image.png', eventedParent: map});

        expect(source.loaded()).toBe(false);
        source.onAdd(map);
        await sleep(0);
        server.respond();
        await sleep(0);
        expect(source.loaded()).toBe(true);

        const missingImagesource = createSource({url: '/missing-image.png', eventedParent: map});

        // Suppress errors as we're loading a missing image.
        map.on('error', () => {});

        expect(missingImagesource.loaded()).toBe(false);
        missingImagesource.onAdd(map);
        await sleep(0);
        server.respond();
        await sleep(0);

        expect(missingImagesource.loaded()).toBe(true);
    });

    test('does not throw when updateImage is called while a request is pending', async () => {
        const source = createSource({url: '/image.png', eventedParent: map});

        const errorHandler = vi.fn();
        source.on('error', errorHandler);

        source.onAdd(map);
        source.updateImage({url: '/image2.png'});

        await sleep(0);

        expect(errorHandler).not.toHaveBeenCalled();
    });

    describe('superseding an in-flight load', () => {
        let source: ImageSource;
        let errorHandler: Mock;

        beforeEach(() => {
            source = createSource({url: '/image.png', eventedParent: map});
            errorHandler = vi.fn();
            map.on('error', errorHandler);
            source.map = map;
        });

        test('cancels a load before its request is issued and keeps the new image', async () => {
            const getImageSpy = vi.spyOn(ImageRequest, 'getImage').mockImplementation(async () => ({data: new ImageBitmap()}));
            const load = source.load();

            const bitmap = new ImageBitmap();
            source.updateImage({image: bitmap});
            await load;

            expect(getImageSpy).not.toHaveBeenCalled();
            expect(source.image).toBe(bitmap);
            expect(errorHandler).not.toHaveBeenCalled();
        });

        test('a superseded load neither reports itself loaded nor disarms its replacement', async () => {
            const {controllers, started} = stubInFlightImageRequests(2);
            const first = source.load();
            await started[0];

            source.updateImage({url: '/image2.png'});
            await first;
            await started[1];

            expect(source.loaded()).toBe(false);

            const bitmap = new ImageBitmap();
            source.updateImage({image: bitmap});

            expect(controllers).toHaveLength(2);
            expect(controllers[1].signal.aborted).toBe(true);
            expect(source.image).toBe(bitmap);
            expect(errorHandler).not.toHaveBeenCalled();
        });

        test('a superseded load that still succeeds leaves its replacement armed', async () => {
            let markFirstRequestIssued: () => void;
            const firstRequestIssued = new Promise<void>((resolve) => {
                markFirstRequestIssued = resolve;
            });
            let respondToFirstRequest: (response: {data: ImageBitmap}) => void;

            let markReplacementRequestIssued: () => void;
            const replacementRequestIssued = new Promise<void>((resolve) => {
                markReplacementRequestIssued = resolve;
            });
            let replacementController: AbortController;

            // No abort listener: past the response, the decode ignores the signal.
            const getImageSpy = vi.spyOn(ImageRequest, 'getImage')
                .mockReturnValueOnce(new Promise<{data: ImageBitmap}>((resolve) => {
                    respondToFirstRequest = resolve;
                    markFirstRequestIssued();
                }))
                .mockImplementationOnce((_request, abortController) => {
                    replacementController = abortController;
                    markReplacementRequestIssued();
                    return new Promise<{data: ImageBitmap}>(() => {});
                });

            const firstLoad = source.load();
            await firstRequestIssued;
            source.updateImage({url: '/image2.png'});
            await replacementRequestIssued;

            respondToFirstRequest({data: new ImageBitmap()});
            await firstLoad;

            expect(source.loaded()).toBe(false);
            expect(source.image).toBeUndefined();

            const bitmap = new ImageBitmap();
            source.updateImage({image: bitmap});

            expect(getImageSpy).toHaveBeenCalledTimes(2);
            expect(replacementController.signal.aborted).toBe(true);
            expect(errorHandler).not.toHaveBeenCalled();
        });

        test('a superseded load does not overwrite the image that replaced it', async () => {
            let requestStarted: () => void;
            const requestCalled = new Promise<void>((resolve) => {
                requestStarted = resolve;
            });
            let respond: (response: {data: ImageBitmap}) => void;
            // getImage drops the controller once the response is in, so its decode ignores the abort.
            vi.spyOn(ImageRequest, 'getImage').mockImplementation(() => {
                requestStarted();
                return new Promise<{data: ImageBitmap}>((resolve) => {
                    respond = resolve;
                });
            });
            const load = source.load();
            await requestCalled;

            const bitmap = new ImageBitmap();
            source.updateImage({image: bitmap});
            respond({data: new ImageBitmap()});
            await load;

            expect(source.image).toBe(bitmap);
            expect(errorHandler).not.toHaveBeenCalled();
        });
    });

    describe('updateImage with a decoded image', () => {
        let source: ImageSource;
        let transformRequest: Mock<(url: string, resourceType?: string) => any>;
        let errorHandler: Mock;

        beforeEach(() => {
            transformRequest = vi.fn((url: string, _resourceType?: string) => ({url}));
            map.setTransformRequest(transformRequest);
            errorHandler = vi.fn();
            map.on('error', errorHandler);
            source = createSource({url: '/image.png', eventedParent: map});
            // onAdd's load calls transformRequest before its first await; clear that call.
            source.onAdd(map);
            transformRequest.mockClear();
        });

        test('sets the image directly without a network request and fires metadata', () => {
            const handler = vi.fn();
            source.on('data', handler);
            const bitmap = new ImageBitmap();
            const result = source.updateImage({image: bitmap});

            expect(result).toBe(source);
            // The image path must not trigger a request.
            expect(transformRequest).not.toHaveBeenCalled();
            expect(source.image).toBe(bitmap);
            expect(source.loaded()).toBe(true);
            const firedMetadata = handler.mock.calls.some(
                ([e]) => e.dataType === 'source' && e.sourceDataType === 'metadata'
            );
            expect(firedMetadata).toBe(true);
            expect(errorHandler).not.toHaveBeenCalled();
        });

        test('resets the texture so the new image is uploaded on the next prepare', () => {
            source.texture = {} as Texture;
            source.updateImage({image: new ImageBitmap()});

            expect(source.texture).toBeNull();
            expect(errorHandler).not.toHaveBeenCalled();
        });

        test('updates coordinates alongside the image', () => {
            source.updateImage({
                image: new ImageBitmap(),
                coordinates: [[0, 0], [-1, 0], [-1, -1], [0, -1]]
            });

            expect(source.serialize().coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
            expect(errorHandler).not.toHaveBeenCalled();
        });

        test('cancels a pending request', () => {
            const spy = vi.spyOn(source._request, 'abort');
            source.updateImage({image: new ImageBitmap()});
            expect(spy).toHaveBeenCalled();
            expect(errorHandler).not.toHaveBeenCalled();
        });

        test('accepts an ImageData instance', () => {
            const imageData = new ImageData(1, 1);
            source.updateImage({image: imageData});

            expect(transformRequest).not.toHaveBeenCalled();
            expect(source.image).toBe(imageData);
            expect(source.loaded()).toBe(true);
            expect(errorHandler).not.toHaveBeenCalled();
        });
    });

    describe('terrainTileRanges', () => {
        test('sets tile ranges for all zoom levels', () => {
            const source = createSource({url: '/image.png'});
            source.onAdd(map);
            server.respond();
            source.setCoordinates([[-10, 10], [10, 10], [10, -10], [-10, -10]]);

            for (let z = 0; z <= MAX_TILE_ZOOM; z++) {
                expect(source.terrainTileRanges[z]).toBeDefined();
            }
        });

        test('calculates tile ranges properly', () => {
            const source = createSource({url: '/image.png'});
            source.onAdd(map);
            server.respond();
            source.setCoordinates([[11.39585,47.30074],[11.46585,47.30074],[11.46585,47.25074],[11.39585,47.25074]]);
            expect(source.terrainTileRanges[9]).toEqual({
                minWrap: 0,
                maxWrap: 0,
                minTileXWrapped: 272,
                maxTileXWrapped: 272,
                minTileY: 179,
                maxTileY: 179
            });
            expect(source.terrainTileRanges[10]).toEqual({
                minWrap: 0,
                maxWrap: 0,
                minTileXWrapped: 544,
                maxTileXWrapped: 544,
                minTileY: 358,
                maxTileY: 359
            });
            expect(source.terrainTileRanges[11]).toEqual({
                minWrap: 0,
                maxWrap: 0,
                minTileXWrapped: 1088,
                maxTileXWrapped: 1089,
                minTileY: 717,
                maxTileY: 718
            });
            expect(source.terrainTileRanges[12]).toEqual({
                minWrap: 0,
                maxWrap: 0,
                minTileXWrapped: 2177,
                maxTileXWrapped: 2178,
                minTileY: 1435,
                maxTileY: 1436
            });
        });

        test('calculates tile ranges for an image exceeds the world bounds - east', () => {
            const source = createSource({url: '/image.png'});
            source.onAdd(map);
            server.respond();
            source.setCoordinates([[-180, 60], [270, 60], [270, -60], [-180, -60]]);
            expect(source.terrainTileRanges[0]).toEqual({
                minWrap: 0,
                maxWrap: 1,
                minTileXWrapped: 0,
                maxTileXWrapped: 0,
                minTileY: 0,
                maxTileY: 0
            });
            expect(source.terrainTileRanges[1]).toEqual({
                minWrap: 0,
                maxWrap: 1,
                minTileXWrapped: 0,
                maxTileXWrapped: 0,
                minTileY: 0,
                maxTileY: 1
            });
        });

        test('calculates tile ranges for an image exceeds the world bounds - west', () => {
            const source = createSource({url: '/image.png'});
            source.onAdd(map);
            server.respond();
            source.setCoordinates([[120, 60], [-270, 60], [-270, -60], [120, -60]]);
            expect(source.terrainTileRanges[0]).toEqual({
                minWrap: -1,
                maxWrap: 0,
                minTileXWrapped: 0,
                maxTileXWrapped: 0,
                minTileY: 0,
                maxTileY: 0
            });
            expect(source.terrainTileRanges[1]).toEqual({
                minWrap: -1,
                maxWrap: 0,
                minTileXWrapped: 1,
                maxTileXWrapped: 1,
                minTileY: 0,
                maxTileY: 1
            });
        });
    });
});

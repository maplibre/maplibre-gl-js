import {describe, beforeEach, afterEach, test, expect, vi, type Mock} from 'vitest';
import {ImageSource} from './image_source.ts';
import {extend, MAX_TILE_ZOOM} from '../util/util.ts';
import {type FakeServer, fakeServer} from 'nise';
import {beforeMapTest, createMap, sleep, stubAjaxGetImage, waitForEvent} from '../util/test/util.ts';
import {Tile} from '../tile/tile.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
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

async function createLoadedSourceWithTile(map: Map, server: FakeServer) {
    server.respondImmediately = true;
    const source = createSource({url: '/image.png', eventedParent: map});
    const loaded = waitForEvent(source, 'data', (e: MapSourceDataEvent) => e.sourceDataType === 'metadata');
    source.onAdd(map);
    await loaded;

    const {z, x, y} = source.tileID;
    const tile = new Tile(new OverscaledTileID(z, 0, z, x, y), 512);
    await source.loadTile(tile);
    return {source, tile};
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

    test('does not request the image when the source is removed while its request is being transformed', async () => {
        server.respondImmediately = true;
        const source = createSource({url: '/image.png'});
        const errorHandler = vi.fn();
        source.on('error', errorHandler);
        let releaseTransform: (params: {url: string}) => void;
        map.setTransformRequest(() => new Promise<{url: string}>((resolve) => {
            releaseTransform = resolve;
        }));
        const load = vi.spyOn(source, 'load');

        source.onAdd(map);
        source.onRemove();
        releaseTransform({url: '/image.png'});
        await load.mock.results[0].value;

        expect(server.requests).toHaveLength(0);
        expect(errorHandler).not.toHaveBeenCalled();
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

    test('sets perspective transform for non-parallelogram coordinates', () => {
        const source = createSource({url: '/image.png'});
        source.setCoordinates([
            [-122.52, 37.815],
            [-122.355, 37.8],
            [-122.325, 37.7],
            [-122.545, 37.735]
        ]);

        expect(source.perspectiveTransform).not.toEqual([0, 0, 1]);
        expect(source.perspectiveTransform.every(Number.isFinite)).toBe(true);
    });

    test('sets perspective transform when initial coordinates are loaded', async () => {
        const source = createSource({
            url: '/image.png',
            coordinates: [
                [-122.52, 37.815],
                [-122.355, 37.8],
                [-122.325, 37.7],
                [-122.545, 37.735]
            ]
        });
        const promise = waitForEvent(source, 'data', (e) => e.sourceDataType === 'content');

        source.onAdd(map);
        await sleep(0);
        server.respond();
        await promise;

        expect(source.perspectiveTransform).not.toEqual([0, 0, 1]);
        expect(source.perspectiveTransform.every(Number.isFinite)).toBe(true);
    });

    test('keeps projective transform when its constant coefficient is zero', () => {
        const source = createSource({url: '/image.png'});
        source.setCoordinates([
            [-67.5, 55.77657301866769],
            [-22.5, 55.77657301866769],
            [0, 40.97989806962013],
            [-90, 40.97989806962013]
        ]);

        expect(source.perspectiveTransform).toEqual([0, 1, 0]);
    });

    test('sets identity perspective transform for parallelogram coordinates', () => {
        const source = createSource({url: '/image.png'});
        source.setCoordinates([
            [-122.431640625, 37.857507156],
            [-122.409667969, 37.857507156],
            [-122.409667969, 37.840156836],
            [-122.431640625, 37.840156836]
        ]);

        expect(source.perspectiveTransform).toEqual([0, 0, 1]);
    });

    test('sets identity perspective transform for collinear destination coordinates', () => {
        const source = createSource({url: '/image.png'});
        source.setCoordinates([
            [-122.431640625, 37.857507156],
            [-122.409667969, 37.857507156],
            [-122.387695312, 37.857507156],
            [-122.365722656, 37.857507156]
        ]);

        expect(source.perspectiveTransform).toEqual([0, 0, 1]);
    });

    test('sets identity perspective transform when the inverse basis is singular', () => {
        const source = createSource({url: '/image.png'});
        source.setCoordinates([
            [-122.431640625, 37.857507156],
            [-122.431640625, 37.840156836],
            [-122.431640625, 37.822802434],
            [-122.409667969, 37.857507156]
        ]);

        expect(source.perspectiveTransform).toEqual([0, 0, 1]);
    });

    test('sets identity perspective transform for a cancellation-degenerate quad', () => {
        const source = createSource({url: '/image.png'});
        source.setCoordinates([
            [96.85546875, 79.36770077764092],
            [-127.265625, 79.36770077764092],
            [88.06640625, 79.36770077764092],
            [-17.40234375, 59.534318001095585]
        ]);

        expect(source.perspectiveTransform).toEqual([0, 0, 1]);
    });

    test('sets identity perspective transform when its denominator crosses zero inside the quad', () => {
        const source = createSource({url: '/image.png'});
        source.setCoordinates([
            [-90, 66.51326044311186],
            [0, 66.51326044311186],
            [-78.75, 61.606396371386275],
            [-90, 0]
        ]);

        expect(source.perspectiveTransform).toEqual([0, 0, 1]);
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

    test('uploads a url into the texture the tiles already hold', async () => {
        const {source, tile} = await createLoadedSourceWithTile(map, server);
        source.prepare();
        const texture = source.texture;
        const upload = vi.spyOn(texture, 'update');
        const destroy = vi.spyOn(texture, 'destroy');

        const load = vi.spyOn(source, 'load');
        source.updateImage({url: '/image2.png'});
        await load.mock.results[0].value;
        source.prepare();

        expect(upload).toHaveBeenCalledTimes(1);
        expect(destroy).not.toHaveBeenCalled();
        expect(source.texture).toBe(texture);
        expect(tile.texture).toBe(texture);
    });

    test('uploads a decoded image into the texture the tiles already hold', async () => {
        const {source, tile} = await createLoadedSourceWithTile(map, server);
        source.prepare();
        const texture = source.texture;
        const upload = vi.spyOn(texture, 'update');
        const destroy = vi.spyOn(texture, 'destroy');

        source.updateImage({image: new ImageBitmap()});
        source.prepare();

        expect(upload).toHaveBeenCalledTimes(1);
        expect(destroy).not.toHaveBeenCalled();
        expect(source.texture).toBe(texture);
        expect(tile.texture).toBe(texture);
    });

    test('keeps the texture the tiles hold live when updateImage runs from an event fired during prepare', async () => {
        const {source, tile} = await createLoadedSourceWithTile(map, server);
        source.on('data', (e: MapSourceDataEvent) => {
            if (e.sourceDataType === 'idle') source.updateImage({image: new ImageBitmap()});
        });

        source.prepare();

        expect(source.texture).toBeTruthy();
        expect(tile.texture).toBe(source.texture);
        expect(source.texture.texture).not.toBeNull();

        const upload = vi.spyOn(source.texture, 'update');
        source.prepare();
        expect(upload).toHaveBeenCalledTimes(1);
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

    test('keeps the image handed to updateImage instead of the url load it replaced', async () => {
        const source = createSource({url: '/image.png', eventedParent: map});
        const bitmap = new ImageBitmap();
        const load = vi.spyOn(source, 'load');

        source.onAdd(map);
        source.updateImage({image: bitmap});
        server.respondImmediately = true;
        await load.mock.results[0].value;

        expect(source.image).toBe(bitmap);
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

    test('cancels the request updateImage started when updateImage is used again', async () => {
        const source = createSource({url: '/image.png', eventedParent: map});
        const load = vi.spyOn(source, 'load');

        source.onAdd(map);
        source.updateImage({url: '/image2.png'});
        await load.mock.results[0].value;

        const spy = vi.spyOn(server.requests[0] as any, 'abort');

        source.updateImage({url: '/image3.png'});
        expect(spy).toHaveBeenCalledTimes(1);
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

    test('keeps the image it displays, and its texture, when the url handed to updateImage fails to load', async () => {
        const {source} = await createLoadedSourceWithTile(map, server);
        source.prepare();
        const texture = source.texture;
        const image = source.image;
        const upload = vi.spyOn(texture, 'update');
        const destroy = vi.spyOn(texture, 'destroy');
        const errorHandler = vi.fn();
        map.on('error', errorHandler);

        const load = vi.spyOn(source, 'load');
        source.updateImage({url: '/missing-image.png'});
        await load.mock.results[0].value;
        source.prepare();

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(destroy).not.toHaveBeenCalled();
        expect(upload).not.toHaveBeenCalled();
        expect(source.texture).toBe(texture);
        expect(source.image).toBe(image);
    });

    test('deletes its texture and drops its image when the source is removed', async () => {
        const {source} = await createLoadedSourceWithTile(map, server);
        source.prepare();
        const destroy = vi.spyOn(source.texture, 'destroy');

        source.onRemove();

        expect(destroy).toHaveBeenCalledTimes(1);
        expect(source.texture).toBeNull();
        expect(source.image).toBeNull();
        expect(source.tiles).toEqual({});
    });

    describe('updateImage with a decoded image', () => {
        let source: ImageSource;
        let transformRequest: Mock<(url: string, resourceType?: string) => any>;

        beforeEach(() => {
            transformRequest = vi.fn((url: string, _resourceType?: string) => ({url}));
            map.setTransformRequest(transformRequest);
            // Suppress errors from aborting the initial (never-responded) request.
            map.on('error', () => {});
            source = createSource({url: '/image.png', eventedParent: map});
            // onAdd starts the initial load synchronously up to its first await, so
            // this._abortController is set and transformRequest is called once. Clear that call
            // so tests can assert the image path issues no further request.
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
        });

        test('updates coordinates alongside the image', () => {
            source.updateImage({
                image: new ImageBitmap(),
                coordinates: [[0, 0], [-1, 0], [-1, -1], [0, -1]]
            });

            expect(source.serialize().coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
        });

        test('cancels a pending request', () => {
            const spy = vi.spyOn(source._abortController, 'abort');
            source.updateImage({image: new ImageBitmap()});
            expect(spy).toHaveBeenCalled();
        });

        test('accepts an ImageData instance', () => {
            const imageData = new ImageData(1, 1);
            source.updateImage({image: imageData});

            expect(transformRequest).not.toHaveBeenCalled();
            expect(source.image).toBe(imageData);
            expect(source.loaded()).toBe(true);
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

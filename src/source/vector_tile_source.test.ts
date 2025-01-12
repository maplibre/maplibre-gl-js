import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {fakeServer, type FakeServer} from 'nise';
import {type Source} from './source';
import {VectorTileSource} from './vector_tile_source';
import {type Tile} from './tile';
import {OverscaledTileID} from './tile_id';
import {Evented} from '../util/evented';
import {RequestManager} from '../util/request_manager';
import fixturesSource from '../../test/unit/assets/source.json' with {type: 'json'};
import {getMockDispatcher, getWrapDispatcher, sleep, waitForMetadataEvent} from '../util/test/util';
import {type Map} from '../ui/map';
import {type WorkerTileParameters} from './worker_source';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings';
import {type ActorMessage, MessageType} from '../util/actor_messages';

function createSource(options, transformCallback?, clearTiles = () => {}) {
    const source = new VectorTileSource('id', options, getMockDispatcher(), options.eventedParent);
    source.onAdd({
        transform: {showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        style: {
            sourceCaches: {id: {clearTiles}},
            projection: {
                get subdivisionGranularity() {
                    return SubdivisionGranularitySetting.noSubdivision;
                }
            }
        },
        getPixelRatio() { return 1; },
    } as any as Map);

    source.on('error', () => { }); // to prevent console log of errors

    return source;
}

describe('VectorTileSource', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });

    afterEach(() => {
        server.restore();
    });

    test('can be constructed from TileJSON', async () => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });

        await waitForMetadataEvent(source);
        expect(source.tiles).toEqual(['http://example.com/{z}/{x}/{y}.png']);
        expect(source.minzoom).toBe(1);
        expect(source.maxzoom).toBe(10);
        expect((source as Source).attribution).toBe('MapLibre');
    });

    test('can be constructed from a TileJSON URL', async () => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: '/source.json'});

        const promise = waitForMetadataEvent(source);
        server.respond();

        await promise;
        expect(source.tiles).toEqual(['http://example.com/{z}/{x}/{y}.png']);
        expect(source.minzoom).toBe(1);
        expect(source.maxzoom).toBe(10);
        expect((source as Source).attribution).toBe('MapLibre');
    });

    test('transforms the request for TileJSON URL', () => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const transformSpy = vi.fn().mockImplementation((url) => {
            return {url};
        });

        createSource({url: '/source.json'}, transformSpy);
        server.respond();
        expect(transformSpy).toHaveBeenCalledWith('/source.json', 'Source');
    });

    test('fires event with metadata property', () => new Promise<void>(done => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const source = createSource({url: '/source.json'});
        source.on('data', (e) => {
            if (e.sourceDataType === 'content') done();
        });
        server.respond();
    }));

    test('fires "dataloading" event', async () => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const evented = new Evented();
        let dataloadingFired = false;
        evented.on('dataloading', () => {
            dataloadingFired = true;
        });
        const source = createSource({url: '/source.json', eventedParent: evented});
        const promise = waitForMetadataEvent(source);
        server.respond();

        await promise;
        expect(dataloadingFired).toBeTruthy();
    });

    test('serialize URL', () => {
        const source = createSource({
            url: 'http://localhost:2900/source.json'
        });
        expect(source.serialize()).toEqual({
            type: 'vector',
            url: 'http://localhost:2900/source.json'
        });
    });

    test('serialize TileJSON', () => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        expect(source.serialize()).toEqual({
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
    });

    function testScheme(scheme, expectedURL) {
        test(`scheme "${scheme}"`, async () => {
            const source = createSource({
                minzoom: 1,
                maxzoom: 10,
                attribution: 'MapLibre',
                tiles: ['http://example.com/{z}/{x}/{y}.png'],
                scheme
            });

            let receivedMessage: ActorMessage<MessageType> = null;

            source.dispatcher = getWrapDispatcher()({
                sendAsync(message) {
                    receivedMessage = message;
                    return Promise.resolve({});
                }
            });

            await waitForMetadataEvent(source);
            await source.loadTile({
                loadVectorData() {},
                tileID: new OverscaledTileID(10, 0, 10, 5, 5)
            } as any as Tile);

            expect(receivedMessage.type).toBe(MessageType.loadTile);
            expect(expectedURL).toBe((receivedMessage.data as WorkerTileParameters).request.url);
        });
    }

    testScheme('xyz', 'http://example.com/10/5/5.png');
    testScheme('tms', 'http://example.com/10/5/1018.png');

    test('transforms tile urls before requesting', async () => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: '/source.json'});
        const transformSpy = vi.spyOn(source.map._requestManager, 'transformRequest');
        const promise = waitForMetadataEvent(source);
        server.respond();
        await promise;

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData() {},
            setExpiryData() {}
        } as any as Tile;
        source.loadTile(tile);
        expect(transformSpy).toHaveBeenCalledTimes(1);
        expect(transformSpy).toHaveBeenCalledWith('http://example.com/10/5/5.png', 'Tile');
    });

    test('loads a tile even in case of 404', async () => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: '/source.json'});
        source.dispatcher = getWrapDispatcher()({
            sendAsync(_message) {
                const error = new Error();
                (error as any).status = 404;
                return Promise.reject(error);
            }
        });
        const promise = waitForMetadataEvent(source);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData: vi.fn(),
            setExpiryData() {}
        } as any as Tile;
        await source.loadTile(tile);
        expect(tile.loadVectorData).toHaveBeenCalledTimes(1);
    });

    test('does not load a tile in case of error', async () => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: '/source.json'});
        source.dispatcher = getWrapDispatcher()({
            async sendAsync(_message) {
                throw new Error('Error');
            }
        });
        const promise = waitForMetadataEvent(source);
        server.respond();
        await promise;
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData: vi.fn(),
            setExpiryData() {}
        } as any as Tile;
        await expect(source.loadTile(tile)).rejects.toThrow('Error');
        expect(tile.loadVectorData).toHaveBeenCalledTimes(0);
    });

    test('loads an empty tile received from worker', async () => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: '/source.json'});
        source.dispatcher = getWrapDispatcher()({
            sendAsync(_message) {
                return Promise.resolve(null);
            }
        });

        const promise = waitForMetadataEvent(source);
        server.respond();
        await promise;

        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData: vi.fn(),
            setExpiryData() {}
        } as any as Tile;
        await source.loadTile(tile);
        expect(tile.loadVectorData).toHaveBeenCalledTimes(1);
    });

    test('reloads a loading tile properly', async () => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        const events = [];
        source.dispatcher = getWrapDispatcher()({
            sendAsync(message) {
                events.push(message.type);
                return Promise.resolve({});
            }
        });

        await waitForMetadataEvent(source);
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData () {
                this.state = 'loaded';
                events.push('tileLoaded');
            },
            setExpiryData() {}
        } as any as Tile;
        const initialLoadPromise = source.loadTile(tile);

        expect(tile.state).toBe('loading');
        await source.loadTile(tile);
        expect(events).toEqual([MessageType.loadTile, 'tileLoaded', MessageType.reloadTile, 'tileLoaded']);
        await expect(initialLoadPromise).resolves.toBeUndefined();
    });

    test('respects TileJSON.bounds', async () => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        });
        await waitForMetadataEvent(source);

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

        await waitForMetadataEvent(source);
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

        const promise = waitForMetadataEvent(source);
        server.respond();

        await promise;
        expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
        expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
    });

    test('respects collectResourceTiming parameter on source', async () => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            collectResourceTiming: true
        });
        let receivedMessage = null;
        source.dispatcher = getWrapDispatcher()({
            sendAsync(message) {
                receivedMessage = message;

                // do nothing for cache size check dispatch
                source.dispatcher = getMockDispatcher();

                return Promise.resolve({});
            }
        });

        await waitForMetadataEvent(source);
        const tile = {
            tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            state: 'loading',
            loadVectorData() {},
            setExpiryData() {}
        } as any as Tile;
        await source.loadTile(tile);

        expect((receivedMessage.data as WorkerTileParameters).request.collectResourceTiming).toBeTruthy();
    });

    test('cancels TileJSON request if removed', () => {
        const source = createSource({url: '/source.json'});
        source.onRemove();
        expect((server.lastRequest as any).aborted).toBe(true);
    });

    test('supports url property updates', () => {
        const source = createSource({
            url: 'http://localhost:2900/source.json'
        });
        source.setUrl('http://localhost:2900/source2.json');
        expect(source.serialize()).toEqual({
            type: 'vector',
            url: 'http://localhost:2900/source2.json'
        });
    });

    test('supports tiles property updates', () => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        source.setTiles(['http://example2.com/{z}/{x}/{y}.png']);
        expect(source.serialize()).toEqual({
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: 'MapLibre',
            tiles: ['http://example2.com/{z}/{x}/{y}.png']
        });
    });

    test('setTiles only clears the cache once the TileJSON has reloaded', async () => {
        const clearTiles = vi.fn();
        const source = createSource({tiles: ['http://example.com/{z}/{x}/{y}.pbf']}, undefined, clearTiles);
        source.setTiles(['http://example2.com/{z}/{x}/{y}.pbf']);
        expect(clearTiles.mock.calls).toHaveLength(0);
        await sleep(0);
        await source.once('data');
        expect(clearTiles.mock.calls).toHaveLength(1);
    });
});

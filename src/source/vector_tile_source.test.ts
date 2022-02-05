import {fakeServer, FakeServer} from 'nise';
import {Source} from './source';
import VectorTileSource from './vector_tile_source';
import Tile from './tile';
import {OverscaledTileID} from './tile_id';
import {Evented} from '../util/evented';
import {RequestManager} from '../util/request_manager';
import fixturesSource from '../../test/unit/assets/source.json';
import {getMockDispatcher, getWrapDispatcher} from '../util/test/util';
import Map from '../ui/map';

function createSource(options, transformCallback?, clearTiles = () => {}) {
    const source = new VectorTileSource('id', options, getMockDispatcher(), options.eventedParent);
    source.onAdd({
        transform: {showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        style: {sourceCaches: {id: {clearTiles}}},
        getPixelRatio() { return 1; }
    } as any as Map);

    source.on('error', (e) => {
        throw e.error;
    });

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

    test('can be constructed from TileJSON', done => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: 'Maplibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.tiles).toEqual(['http://example.com/{z}/{x}/{y}.png']);
                expect(source.minzoom).toBe(1);
                expect(source.maxzoom).toBe(10);
                expect((source as Source).attribution).toBe('Maplibre');
                done();
            }
        });
    });

    test('can be constructed from a TileJSON URL', done => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: '/source.json'});

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.tiles).toEqual(['http://example.com/{z}/{x}/{y}.png']);
                expect(source.minzoom).toBe(1);
                expect(source.maxzoom).toBe(10);
                expect((source as Source).attribution).toBe('Maplibre');
                done();
            }
        });

        server.respond();
    });

    test('transforms the request for TileJSON URL', () => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const transformSpy = jest.fn().mockImplementation((url) => {
            return {url};
        });

        createSource({url: '/source.json'}, transformSpy);
        server.respond();
        expect(transformSpy).toHaveBeenCalledWith('/source.json', 'Source');
    });

    test('fires event with metadata property', done => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const source = createSource({url: '/source.json'});
        source.on('data', (e) => {
            if (e.sourceDataType === 'content') done();
        });
        server.respond();
    });

    test('fires "dataloading" event', done => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const evented = new Evented();
        let dataloadingFired = false;
        evented.on('dataloading', () => {
            dataloadingFired = true;
        });
        const source = createSource({url: '/source.json', eventedParent: evented});
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                if (!dataloadingFired) done('test failed: dataloading not fired');
                done();
            }
        });
        server.respond();
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
            attribution: 'Maplibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        expect(source.serialize()).toEqual({
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: 'Maplibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
    });

    function testScheme(scheme, expectedURL) {
        test(`scheme "${scheme}"`, done => {
            const source = createSource({
                minzoom: 1,
                maxzoom: 10,
                attribution: 'Maplibre',
                tiles: ['http://example.com/{z}/{x}/{y}.png'],
                scheme
            });

            source.dispatcher = getWrapDispatcher()({
                send(type, params) {
                    expect(type).toBe('loadTile');
                    expect(expectedURL).toBe(params.request.url);
                    done();
                }
            });

            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5)
                } as any as Tile, () => {});
            });
        });
    }

    testScheme('xyz', 'http://example.com/10/5/5.png');
    testScheme('tms', 'http://example.com/10/5/1018.png');

    test('transforms tile urls before requesting', done => {
        server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: '/source.json'});
        const transformSpy = jest.spyOn(source.map._requestManager, 'transformRequest');
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                } as any as Tile;
                source.loadTile(tile, () => {});
                expect(transformSpy).toHaveBeenCalledTimes(1);
                expect(transformSpy).toHaveBeenCalledWith('http://example.com/10/5/5.png', 'Tile');
                done();
            }
        });

        server.respond();
    });

    test('reloads a loading tile properly', done => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        const events = [];
        source.dispatcher = getWrapDispatcher()({
            send(type, params, cb) {
                events.push(type);
                if (cb) setTimeout(cb, 0);
                return 1;
            }
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {
                        this.state = 'loaded';
                        events.push('tileLoaded');
                    },
                    setExpiryData() {}
                } as any as Tile;
                source.loadTile(tile, () => {});
                expect(tile.state).toBe('loading');
                source.loadTile(tile, () => {
                    expect(events).toEqual(
                        ['loadTile', 'tileLoaded', 'enforceCacheSizeLimit', 'reloadTile', 'tileLoaded']
                    );
                    done();
                });
            }
        });
    });

    test('respects TileJSON.bounds', done => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Maplibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        });
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
                expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
                done();
            }
        });
    });

    test('does not error on invalid bounds', done => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Maplibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, 91]
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.tileBounds.bounds).toEqual({_sw:{lng: -47, lat: -7}, _ne:{lng: -45, lat: 90}});
                done();
            }
        });
    });

    test('respects TileJSON.bounds when loaded from TileJSON', done => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Maplibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: '/source.json'});

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
                expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
                done();
            }
        });
        server.respond();
    });

    test('respects collectResourceTiming parameter on source', done => {
        const source = createSource({
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            collectResourceTiming: true
        });
        source.dispatcher = getWrapDispatcher()({
            send(type, params, cb) {
                expect(params.request.collectResourceTiming).toBeTruthy();
                setTimeout(cb, 0);
                done();

                // do nothing for cache size check dispatch
                source.dispatcher = getMockDispatcher();

                return 1;
            }
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                } as any as Tile;
                source.loadTile(tile, () => {});
            }
        });
    });

    test('cancels TileJSON request if removed', () => {
        const source = createSource({url: '/source.json'});
        source.onRemove();
        expect((server as any).lastRequest.aborted).toBe(true);
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
            attribution: 'Maplibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        });
        source.setTiles(['http://example2.com/{z}/{x}/{y}.png']);
        expect(source.serialize()).toEqual({
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: 'Maplibre',
            tiles: ['http://example2.com/{z}/{x}/{y}.png']
        });
    });

    test('setTiles only clears the cache once the TileJSON has reloaded', done => {
        const clearTiles = jest.fn();
        const source = createSource({tiles: ['http://example.com/{z}/{x}/{y}.pbf']}, undefined, clearTiles);
        source.setTiles(['http://example2.com/{z}/{x}/{y}.pbf']);
        expect(clearTiles.mock.calls).toHaveLength(0);
        source.once('data', () => {
            expect(clearTiles.mock.calls).toHaveLength(1);
            done();
        });
    });
});

import '../../stub_loader';
import {test} from '../../util/test';
import VectorTileSource from '../../../rollup/build/tsc/src/source/vector_tile_source';
import {OverscaledTileID} from '../../../rollup/build/tsc/src/source/tile_id';
import {Evented} from '../../../rollup/build/tsc/src/util/evented';
import {RequestManager} from '../../../rollup/build/tsc/src/util/request_manager';
import fixturesSource from '../../fixtures/source.json';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher;
        }
    };
};

const mockDispatcher = wrapDispatcher({
    send () {}
});

function createSource(options, transformCallback) {
    const source = new VectorTileSource('id', options, mockDispatcher, options.eventedParent);
    source.onAdd({
        transform: {showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback),
        style: {sourceCaches: {id: {clearTiles: () => {}}}}
    });

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

test('VectorTileSource', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        callback();
    });

    t.test('can be constructed from TileJSON', (t) => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.tiles).toEqual(["http://example.com/{z}/{x}/{y}.png"]);
                expect(source.minzoom).toEqual(1);
                expect(source.maxzoom).toEqual(10);
                expect(source.attribution).toEqual("Mapbox");
                t.end();
            }
        });
    });

    t.test('can be constructed from a TileJSON URL', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: "/source.json"});

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.tiles).toEqual(["http://example.com/{z}/{x}/{y}.png"]);
                expect(source.minzoom).toEqual(1);
                expect(source.maxzoom).toEqual(10);
                expect(source.attribution).toEqual("Mapbox");
                t.end();
            }
        });

        window.server.respond();
    });

    t.test('transforms the request for TileJSON URL', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const transformSpy = t.spy((url) => {
            return {url};
        });

        createSource({url: "/source.json"}, transformSpy);
        window.server.respond();
        expect(transformSpy.getCall(0).args[0]).toBe('/source.json');
        expect(transformSpy.getCall(0).args[1]).toBe('Source');
        t.end();
    });

    t.test('fires event with metadata property', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const source = createSource({url: "/source.json"});
        source.on('data', (e) => {
            if (e.sourceDataType === 'content') t.end();
        });
        window.server.respond();
    });

    t.test('fires "dataloading" event', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(fixturesSource));
        const evented = new Evented();
        let dataloadingFired = false;
        evented.on('dataloading', () => {
            dataloadingFired = true;
        });
        const source = createSource({url: "/source.json", eventedParent: evented});
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                if (!dataloadingFired) t.fail();
                t.end();
            }
        });
        window.server.respond();
    });

    t.test('serialize URL', (t) => {
        const source = createSource({
            url: "http://localhost:2900/source.json"
        });
        expect(source.serialize()).toEqual({
            type: 'vector',
            url: "http://localhost:2900/source.json"
        });
        t.end();
    });

    t.test('serialize TileJSON', (t) => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        expect(source.serialize()).toEqual({
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        t.end();
    });

    function testScheme(scheme, expectedURL) {
        t.test(`scheme "${scheme}"`, (t) => {
            const source = createSource({
                minzoom: 1,
                maxzoom: 10,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                scheme
            });

            source.dispatcher = wrapDispatcher({
                send(type, params) {
                    expect(type).toBe('loadTile');
                    expect(expectedURL).toBe(params.request.url);
                    t.end();
                }
            });

            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5)
                }, () => {});
            });
        });
    }

    testScheme('xyz', 'http://example.com/10/5/5.png');
    testScheme('tms', 'http://example.com/10/5/1018.png');

    t.test('transforms tile urls before requesting', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(fixturesSource));

        const source = createSource({url: "/source.json"});
        const transformSpy = t.spy(source.map._requestManager, 'transformRequest');
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});
                expect(transformSpy.calledOnce).toBeTruthy();
                expect(transformSpy.getCall(0).args[0]).toBe('http://example.com/10/5/5.png');
                expect(transformSpy.getCall(0).args[1]).toBe('Tile');
                t.end();
            }
        });

        window.server.respond();
    });

    t.test('reloads a loading tile properly', (t) => {
        const source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        const events = [];
        source.dispatcher = wrapDispatcher({
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
                };
                source.loadTile(tile, () => {});
                expect(tile.state).toBe('loading');
                source.loadTile(tile, () => {
                    expect(events).toEqual(
                        ['loadTile', 'tileLoaded', 'enforceCacheSizeLimit', 'reloadTile', 'tileLoaded']
                    );
                    t.end();
                });
            }
        });
    });

    t.test('respects TileJSON.bounds', (t) => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        });
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
                expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
                t.end();
            }
        });
    });

    t.test('does not error on invalid bounds', (t) => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, 91]
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.tileBounds.bounds).toEqual({_sw:{lng: -47, lat: -7}, _ne:{lng: -45, lat: 90}});
                t.end();
            }
        });
    });

    t.test('respects TileJSON.bounds when loaded from TileJSON', (t) => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: "/source.json"});

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();
                expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy();
                t.end();
            }
        });
        window.server.respond();
    });

    t.test('respects collectResourceTiming parameter on source', (t) => {
        const source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            collectResourceTiming: true
        });
        source.dispatcher = wrapDispatcher({
            send(type, params, cb) {
                expect(params.request.collectResourceTiming).toBeTruthy();
                setTimeout(cb, 0);
                t.end();

                // do nothing for cache size check dispatch
                source.dispatcher = mockDispatcher;

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
                };
                source.loadTile(tile, () => {});
            }
        });
    });

    t.test('cancels TileJSON request if removed', (t) => {
        const source = createSource({url: "/source.json"});
        source.onRemove();
        expect(window.server.lastRequest.aborted).toBe(true);
        t.end();
    });

    t.test('supports url property updates', (t) => {
        const source = createSource({
            url: "http://localhost:2900/source.json"
        });
        source.setUrl("http://localhost:2900/source2.json");
        expect(source.serialize()).toEqual({
            type: 'vector',
            url: "http://localhost:2900/source2.json"
        });
        t.end();
    });

    t.test('supports tiles property updates', (t) => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        source.setTiles(["http://example2.com/{z}/{x}/{y}.png"]);
        expect(source.serialize()).toEqual({
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example2.com/{z}/{x}/{y}.png"]
        });
        t.end();
    });

    t.end();
});

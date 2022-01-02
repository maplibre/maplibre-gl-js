import '../../stub_loader';
import RasterDEMTileSource from '../source/raster_dem_tile_source';
import {OverscaledTileID} from '../source/tile_id';
import {RequestManager} from '../util/request_manager';

function createSource(options, transformCallback) {
    const source = new RasterDEMTileSource('id', options, {send() {}}, options.eventedParent);
    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback)
    });

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

describe('RasterTileSource', done => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        callback();
    });

    test('transforms request for TileJSON URL', done => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Mapbox',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));
        const transformSpy = jest.spyOn((url) => {
            return {url};
        });

        createSource({url: '/source.json'}, transformSpy);
        window.server.respond();

        expect(transformSpy.getCall(0).args[0]).toBe('/source.json');
        expect(transformSpy.getCall(0).args[1]).toBe('Source');
        done();
    });

    test('transforms tile urls before requesting', done => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Mapbox',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: '/source.json'});
        const transformSpy = jest.spyOn(source.map._requestManager, 'transformRequest');
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
                done();

            }
        });
        window.server.respond();
    });
    test('populates neighboringTiles', done => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Mapbox',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }));
        const source = createSource({url: '/source.json'});
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});

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

                done();

            }
        });
        window.server.respond();
    });

    test('populates neighboringTiles with wrapped tiles', done => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Mapbox',
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        }));
        const source = createSource({url: '/source.json'});
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(5, 0, 5, 31, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});

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
                done();
            }
        });
        window.server.respond();
    });
    done();

});

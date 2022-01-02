import '../../stub_loader';
import RasterTileSource from '../source/raster_tile_source';
import {OverscaledTileID} from '../source/tile_id';
import {RequestManager} from '../util/request_manager';

function createSource(options, transformCallback) {
    const source = new RasterTileSource('id', options, {send() {}}, options.eventedParent);
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
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
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

    test('respects TileJSON.bounds', done => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Mapbox',
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
            attribution: 'Mapbox',
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
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'Mapbox',
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
        window.server.respond();
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

    test('cancels TileJSON request if removed', done => {
        const source = createSource({url: '/source.json'});
        source.onRemove();
        expect(window.server.lastRequest.aborted).toBe(true);
        done();
    });

    done();
});

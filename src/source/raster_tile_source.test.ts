import {RasterTileSource} from './raster_tile_source';
import {OverscaledTileID} from './tile_id';
import {RequestManager} from '../util/request_manager';
import {Dispatcher} from '../util/dispatcher';
import {fakeServer, type FakeServer} from 'nise';
import {Tile} from './tile';
import {stubAjaxGetImage} from '../util/test/util';

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
    });

    test('transforms request for TileJSON URL', () => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, -5]
        }));
        const transformSpy = jest.fn().mockImplementation((url) => {
            return {url};
        });

        createSource({url: '/source.json'}, transformSpy);
        server.respond();

        expect(transformSpy.mock.calls[0][0]).toBe('/source.json');
        expect(transformSpy.mock.calls[0][1]).toBe('Source');
    });

    test('respects TileJSON.bounds', () => new Promise<void>(done => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
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
    }));

    test('does not error on invalid bounds', () => new Promise<void>(done => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.png'],
            bounds: [-47, -7, -45, 91]
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                expect(source.tileBounds.bounds).toEqual({_sw: {lng: -47, lat: -7}, _ne: {lng: -45, lat: 90}});
                done();
            }
        });
    }));

    test('respects TileJSON.bounds when loaded from TileJSON', () => new Promise<void>(done => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
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
    }));

    test('transforms tile urls before requesting', () => new Promise<void>(done => {
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: 'MapLibre',
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
                } as any as Tile;
                source.loadTile(tile);
                expect(transformSpy).toHaveBeenCalledTimes(1);
                expect(transformSpy.mock.calls[0][0]).toBe('http://example.com/10/5/5.png');
                expect(transformSpy.mock.calls[0][1]).toBe('Tile');
                done();
            }
        });
        server.respond();
    }));

    test('HttpImageElement used to get image when refreshExpiredTiles is false', () => new Promise<void>(done => {
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

        const imageConstructorSpy = jest.spyOn(global, 'Image');
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading'
                } as any as Tile;
                source.loadTile(tile).then(() => {
                    expect(imageConstructorSpy).toHaveBeenCalledTimes(1);
                    expect(tile.state).toBe('loaded');
                    done();
                });
            }
        });
        server.respond();
    }));

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

    test('supports url property updates', () => {
        const source = createSource({
            url: 'http://localhost:2900/source.json'
        });
        source.setUrl('http://localhost:2900/source2.json');
        expect(source.serialize()).toEqual({
            type: 'raster',
            url: 'http://localhost:2900/source2.json'
        });
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
});

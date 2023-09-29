import {ImageSource} from './image_source';
import {Evented} from '../util/evented';
import {Transform} from '../geo/transform';
import {extend} from '../util/util';
import {type FakeServer, fakeServer} from 'nise';
import {RequestManager} from '../util/request_manager';
import {Dispatcher} from '../util/dispatcher';
import {stubAjaxGetImage} from '../util/test/util';
import {Tile} from './tile';
import {OverscaledTileID} from './tile_id';
import {VertexBuffer} from '../gl/vertex_buffer';
import {SegmentVector} from '../data/segment';
import {Texture} from '../render/texture';
import type {ImageSourceSpecification} from '@maplibre/maplibre-gl-style-spec';

function createSource(options) {
    options = extend({
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }, options);

    const source = new ImageSource('id', options, {send() {}} as any as Dispatcher, options.eventedParent);
    return source;
}

class StubMap extends Evented {
    transform: Transform;
    painter: any;
    _requestManager: RequestManager;

    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = {
            transformRequest: (url) => {
                return {url};
            }
        } as any as RequestManager;
        this.painter = {
            context: {
                gl: {}
            }
        };
    }
}

describe('ImageSource', () => {
    stubAjaxGetImage(undefined);
    let server: FakeServer;

    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
        server.respondWith(new ArrayBuffer(1));
    });

    test('constructor', () => {
        const source = createSource({url: '/image.png'});

        expect(source.minzoom).toBe(0);
        expect(source.maxzoom).toBe(22);
        expect(source.tileSize).toBe(512);
    });

    test('fires dataloading event', () => {
        const source = createSource({url: '/image.png'});
        source.on('dataloading', (e) => {
            expect(e.dataType).toBe('source');
        });
        source.onAdd(new StubMap() as any);
        server.respond();
        expect(source.image).toBeTruthy();
    });

    test('transforms url request', () => {
        const source = createSource({url: '/image.png'});
        const map = new StubMap() as any;
        const spy = jest.spyOn(map._requestManager, 'transformRequest');
        source.onAdd(map);
        server.respond();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe('/image.png');
        expect(spy.mock.calls[0][1]).toBe('Image');
    });

    test('updates url from updateImage', () => {
        const source = createSource({url: '/image.png'});
        const map = new StubMap() as any;
        const spy = jest.spyOn(map._requestManager, 'transformRequest');
        source.onAdd(map);
        server.respond();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe('/image.png');
        expect(spy.mock.calls[0][1]).toBe('Image');
        source.updateImage({url: '/image2.png'});
        server.respond();
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0]).toBe('/image2.png');
        expect(spy.mock.calls[1][1]).toBe('Image');
    });

    test('sets coordinates', () => {
        const source = createSource({url: '/image.png'});
        const map = new StubMap() as any;
        source.onAdd(map);
        server.respond();
        const beforeSerialized = source.serialize();
        expect(beforeSerialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
        source.setCoordinates([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
        const afterSerialized = source.serialize();
        expect(afterSerialized.coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
    });

    test('sets coordinates via updateImage', () => {
        const source = createSource({url: '/image.png'});
        const map = new StubMap() as any;
        source.onAdd(map);
        server.respond();
        const beforeSerialized = source.serialize();
        expect(beforeSerialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
        source.updateImage({
            url: '/image2.png',
            coordinates: [[0, 0], [-1, 0], [-1, -1], [0, -1]]
        });
        server.respond();
        const afterSerialized = source.serialize();
        expect(afterSerialized.coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
    });

    test('fires data event when content is loaded', done => {
        const source = createSource({url: '/image.png'});
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                expect(typeof source.tileID == 'object').toBeTruthy();
                done();
            }
        });
        source.onAdd(new StubMap() as any);
        server.respond();
    });

    test('fires data event when metadata is loaded', done => {
        const source = createSource({url: '/image.png'});
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                done();
            }
        });
        source.onAdd(new StubMap() as any);
        server.respond();
    });

    test('fires idle event on prepare call when there is at least one not loaded tile', done => {
        const source = createSource({url: '/image.png'});
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'idle') {
                expect(tile.state).toBe('loaded');
                done();
            }
        });
        source.onAdd(new StubMap() as any);
        server.respond();

        source.tiles[String(tile.tileID.wrap)] = tile;
        source.image = new ImageBitmap();
        // assign dummies directly so we don't need to stub the gl things
        source.boundsBuffer = {} as VertexBuffer;
        source.boundsSegments = {} as SegmentVector;
        source.texture = {} as Texture;
        source.prepare();
    });

    test('serialize url and coordinates', () => {
        const source = createSource({url: '/image.png'});

        const serialized = source.serialize() as ImageSourceSpecification;
        expect(serialized.type).toBe('image');
        expect(serialized.url).toBe('/image.png');
        expect(serialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
    });

    test('allows using updateImage before initial image is loaded', () => {
        const source = createSource({url: '/image.png'});
        const map = new StubMap() as any;

        source.onAdd(map);

        expect(source.image).toBeUndefined();
        source.updateImage({url: '/image2.png'});
        server.respond();
        expect(source.image).toBeTruthy();
    });

    test('cancels request if updateImage is used', () => {
        const source = createSource({url: '/image.png'});
        const map = new StubMap() as any;

        source.onAdd(map);

        const spy = jest.spyOn(server.requests[0] as any, 'abort');

        source.updateImage({url: '/image2.png'});
        expect(spy).toHaveBeenCalled();
    });
});

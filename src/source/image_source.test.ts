import ImageSource from './image_source';
import {Evented} from '../util/evented';
import Transform from '../geo/transform';
import {extend} from '../util/util';
import {fakeXhr} from 'nise';
import {RequestManager} from '../util/request_manager';
import Dispatcher from '../util/dispatcher';
import {stubAjaxGetImage} from '../util/test/util';

function createSource(options) {
    options = extend({
        coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }, options);

    const source = new ImageSource('id', options, {send() {}} as any as Dispatcher, options.eventedParent);
    return source;
}

class StubMap extends Evented {
    transform: Transform;
    _requestManager: RequestManager;

    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = {
            transformRequest: (url) => {
                return {url};
            }
        } as any as RequestManager;
    }
}

describe('ImageSource', () => {
    const requests = [];
    fakeXhr.useFakeXMLHttpRequest().onCreate = (req) => { requests.push(req); };
    stubAjaxGetImage(undefined);
    beforeEach(() => {
        global.fetch = null;
    });

    const respond = () => {
        const req = requests.shift();
        req.setStatus(200);
        req.response = new ArrayBuffer(1);
        req.onload();
    };

    test('constructor', () => {
        const source = createSource({url : '/image.png'});

        expect(source.minzoom).toBe(0);
        expect(source.maxzoom).toBe(22);
        expect(source.tileSize).toBe(512);
    });

    test('fires dataloading event', () => {
        const source = createSource({url : '/image.png'});
        source.on('dataloading', (e) => {
            expect(e.dataType).toBe('source');
        });
        source.onAdd(new StubMap() as any);
        respond();
        expect(source.image).toBeTruthy();
    });

    test('transforms url request', () => {
        const source = createSource({url : '/image.png'});
        const map = new StubMap() as any;
        const spy = jest.spyOn(map._requestManager, 'transformRequest');
        source.onAdd(map);
        respond();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe('/image.png');
        expect(spy.mock.calls[0][1]).toBe('Image');
    });

    test('updates url from updateImage', () => {
        const source = createSource({url : '/image.png'});
        const map = new StubMap() as any;
        const spy = jest.spyOn(map._requestManager, 'transformRequest');
        source.onAdd(map);
        respond();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe('/image.png');
        expect(spy.mock.calls[0][1]).toBe('Image');
        source.updateImage({url: '/image2.png'});
        respond();
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0]).toBe('/image2.png');
        expect(spy.mock.calls[1][1]).toBe('Image');
    });

    test('sets coordinates', () => {
        const source = createSource({url : '/image.png'});
        const map = new StubMap() as any;
        source.onAdd(map);
        respond();
        const beforeSerialized = source.serialize();
        expect(beforeSerialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
        source.setCoordinates([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
        const afterSerialized = source.serialize();
        expect(afterSerialized.coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
    });

    test('sets coordinates via updateImage', () => {
        const source = createSource({url : '/image.png'});
        const map = new StubMap() as any;
        source.onAdd(map);
        respond();
        const beforeSerialized = source.serialize();
        expect(beforeSerialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
        source.updateImage({
            url: '/image2.png',
            coordinates: [[0, 0], [-1, 0], [-1, -1], [0, -1]]
        });
        respond();
        const afterSerialized = source.serialize();
        expect(afterSerialized.coordinates).toEqual([[0, 0], [-1, 0], [-1, -1], [0, -1]]);
    });

    test('fires data event when content is loaded', done => {
        const source = createSource({url : '/image.png'});
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                expect(typeof source.tileID == 'object').toBeTruthy();
                done();
            }
        });
        source.onAdd(new StubMap() as any);
        respond();
    });

    test('fires data event when metadata is loaded', done => {
        const source = createSource({url : '/image.png'});
        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                done();
            }
        });
        source.onAdd(new StubMap() as any);
        respond();
    });

    test('serialize url and coordinates', () => {
        const source = createSource({url: '/image.png'});

        const serialized = source.serialize();
        expect(serialized.type).toBe('image');
        expect(serialized.url).toBe('/image.png');
        expect(serialized.coordinates).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
    });
});

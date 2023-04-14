import {
    getArrayBuffer,
    getJSON,
    postData,
    AJAXError
} from './ajax';
import maplibre from '../index';
import config from '../util/config';

import {fakeServer, FakeServer} from 'nise';

function readAsText(blob) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = () => reject(fileReader.error);
        fileReader.readAsText(blob);
    });
}

describe('ajax', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        config.REGISTERED_PROTOCOLS = {};
        server = fakeServer.create();
    });
    afterEach(() => {
        server.restore();
        config.REGISTERED_PROTOCOLS = {};
    });

    test('getArrayBuffer, 404', done => {
        server.respondWith(request => {
            request.respond(404, undefined, '404 Not Found');
        });
        getArrayBuffer({url: 'http://example.com/test.bin'}, async (error) => {
            const ajaxError = error as AJAXError;
            const body = await readAsText(ajaxError.body);
            expect(ajaxError.status).toBe(404);
            expect(ajaxError.statusText).toBe('Not Found');
            expect(ajaxError.url).toBe('http://example.com/test.bin');
            expect(body).toBe('404 Not Found');
            done();
        });
        server.respond();
    });

    test('getJSON', done => {
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
        });
        getJSON({url: ''}, (error, body) => {
            expect(error).toBeFalsy();
            expect(body).toEqual({foo: 'bar'});
            done();
        });
        server.respond();
    });

    test('getJSON, invalid syntax', done => {
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, 'how do i even');
        });
        getJSON({url: ''}, (error) => {
            expect(error).toBeTruthy();
            done();
        });
        server.respond();
    });

    test('getJSON, 404', done => {
        server.respondWith(request => {
            request.respond(404, undefined, '404 Not Found');
        });
        getJSON({url: 'http://example.com/test.json'}, async (error) => {
            const ajaxError = error as AJAXError;
            const body = await readAsText(ajaxError.body);
            expect(ajaxError.status).toBe(404);
            expect(ajaxError.statusText).toBe('Not Found');
            expect(ajaxError.url).toBe('http://example.com/test.json');
            expect(body).toBe('404 Not Found');
            done();
        });
        server.respond();
    });

    test('postData, 204(no content): no error', done => {
        server.respondWith(request => {
            request.respond(204, undefined, undefined);
        });
        postData({url: 'api.mapbox.com'}, (error) => {
            expect(error).toBeNull();
            done();
        });
        server.respond();
    });

    test('#addProtocol - getJSON', done => {
        maplibre.addProtocol('custom', (reqParam, callback) => {
            callback(null, {'foo': 'bar'});
            return {cancel: () => {}};
        });
        getJSON({url: 'custom://test/url/json'}, (error, data) => {
            expect(error).toBeFalsy();
            expect(data).toEqual({foo: 'bar'});
            done();
        });
    });

    test('#addProtocol - getArrayBuffer', done => {
        maplibre.addProtocol('custom', (reqParam, callback) => {
            callback(null, new ArrayBuffer(1));
            return {cancel: () => {}};
        });
        getArrayBuffer({url: 'custom://test/url/getArrayBuffer'}, async (error, data) => {
            expect(error).toBeFalsy();
            expect(data).toBeInstanceOf(ArrayBuffer);
            done();
        });
    });

    test('#addProtocol - error', () => {
        maplibre.addProtocol('custom', (reqParam, callback) => {
            callback(new Error('error'));
            return {cancel: () => { }};
        });

        getJSON({url: 'custom://test/url/json'}, (error) => {
            expect(error).toBeTruthy();
        });
    });

    test('#addProtocol - Cancel request', () => {
        let cancelCalled = false;
        maplibre.addProtocol('custom', () => {
            return {cancel: () => {
                cancelCalled = true;
            }};
        });
        const request = getJSON({url: 'custom://test/url/json'}, () => { });
        request.cancel();
        expect(cancelCalled).toBeTruthy();
    });
});

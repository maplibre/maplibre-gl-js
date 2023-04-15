import {
    getArrayBuffer,
    getJSON,
    postData,
    AJAXError
} from './ajax';

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
        server = fakeServer.create();
    });
    afterEach(() => {
        server.restore();
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
});

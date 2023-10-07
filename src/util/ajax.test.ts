import {
    getArrayBuffer,
    getJSON,
    postData,
    AJAXError,
    sameOrigin
} from './ajax';

import {fakeServer, type FakeServer} from 'nise';
import {destroyFetchMock, FetchMock, RequestMock, setupFetchMock} from './test/mock_fetch';

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

    test('sameOrigin method', () => {
        jest.spyOn(window, 'location', 'get').mockReturnValue({
            protocol: 'https:',
            host: 'somewhere.com'
        } as any);

        expect(sameOrigin('https://somewhere.com')).toBe(true);
        expect(sameOrigin('https://somewhere.com/path')).toBe(true);
        expect(sameOrigin('https://somewhere.com/path/?q=abc')).toBe(true);

        expect(sameOrigin('https://somewhere.com:443/path')).toBe(true);

        expect(sameOrigin('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=')).toBe(true);
        expect(sameOrigin('blob:https://www.bing.com/09f36686-e57a-420f-9004-918548219b75')).toBe(true);

        // relative URL is same origin for sure
        expect(sameOrigin('/foo')).toBe(true);
        expect(sameOrigin('foo')).toBe(true);

        // empty string is considered as relative, and should be true
        expect(sameOrigin('')).toBe(true);
        expect(sameOrigin(null)).toBe(true);
        expect(sameOrigin(undefined)).toBe(true);

        expect(sameOrigin('HTTPS://somewhere.com')).toBe(true);

        // different domain
        expect(sameOrigin('httpS://www.somewhere.com')).toBe(false);

        // different protocol
        expect(sameOrigin('HTTP://somewhere.com')).toBe(false);
        expect(sameOrigin('file:///c:/temp/foo.html')).toBe(false);

        // file url
        jest.spyOn(window, 'location', 'get').mockReturnValue({
            protocol: 'file:',
            host: ''
        } as any);
        expect(sameOrigin('file:///C:/Temp/abc.html')).toBe(true);
        expect(sameOrigin('HTTP://somewhere.com')).toBe(false);

        // relative URL (for file URL) is same origin as well
        expect(sameOrigin('/foo')).toBe(true);
        expect(sameOrigin('foo')).toBe(true);

        // edge case
        expect(sameOrigin('://foo')).toBe(true);
    });

    describe('requests parameters', () => {
        let fetch: FetchMock;

        beforeEach(() => {
            fetch = setupFetchMock();
        });

        afterEach(() => {
            destroyFetchMock();
        });

        test('should be provided to fetch API in getArrayBuffer function', (done) => {
            getArrayBuffer({url: 'http://example.com/test-params.json', cache: 'force-cache', headers: {'Authorization': 'Bearer 123'}}, () => {
                expect(fetch).toHaveBeenCalledTimes(1);
                expect(fetch).toHaveBeenCalledWith(expect.objectContaining({url: 'http://example.com/test-params.json', method: 'GET', cache: 'force-cache'}));
                expect((fetch.mock.calls[0][0] as RequestMock).headers.get('Authorization')).toBe('Bearer 123');

                done();
            });
        });

        test('should be provided to fetch API in getJSON function', (done) => {
            getJSON({url: 'http://example.com/test-params.json', cache: 'force-cache', headers: {'Authorization': 'Bearer 123'}}, () => {
                expect(fetch).toHaveBeenCalledTimes(1);
                expect(fetch).toHaveBeenCalledWith(expect.objectContaining({url: 'http://example.com/test-params.json', method: 'GET', cache: 'force-cache'}));
                expect((fetch.mock.calls[0][0] as RequestMock).headers.get('Authorization')).toBe('Bearer 123');

                done();
            });
        });
    });
});

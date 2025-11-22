import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {
    getArrayBuffer,
    getJSON,
    type AJAXError,
    sameOrigin
} from './ajax';
import {isAbortError} from './abort_error';

import {fakeServer, type FakeServer} from 'nise';

function readAsText(blob) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = () => reject(fileReader.error);
        fileReader.readAsText(blob);
    });
}

const originalFetch = global.fetch;

describe('ajax', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });
    afterEach(() => {
        server.restore();
    });

    test('getArrayBuffer, 404', async () => {
        server.respondWith(request => {
            request.respond(404, undefined, '404 Not Found');
        });

        try {
            const promise =  getArrayBuffer({url: 'http://example.com/test.bin'}, new AbortController());
            server.respond();
            await promise;
        } catch (error) {
            const ajaxError = error as AJAXError;
            const body = await readAsText(ajaxError.body);
            expect(ajaxError.status).toBe(404);
            expect(ajaxError.statusText).toBe('Not Found');
            expect(ajaxError.url).toBe('http://example.com/test.bin');
            expect(body).toBe('404 Not Found');
        }
    });

    test('getJSON', async () => {
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
        });
        const promise = getJSON({url: ''}, new AbortController());
        server.respond();

        const body = await promise;
        expect(body.data).toEqual({foo: 'bar'});
    });

    test('getJSON, invalid syntax', async () => {
        server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, 'how do i even');
        });
        const promise = getJSON({url: ''}, new AbortController());
        server.respond();
        try {
            await promise;
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });

    test('getJSON, 404', async () => {
        server.respondWith(request => {
            request.respond(404, undefined, '404 Not Found');
        });
        const promise = getJSON({url: 'http://example.com/test.json'}, new AbortController());
        server.respond();

        try {
            await promise;
        } catch (error) {
            const ajaxError = error as AJAXError;
            const body = await readAsText(ajaxError.body);
            expect(ajaxError.status).toBe(404);
            expect(ajaxError.statusText).toBe('Not Found');
            expect(ajaxError.url).toBe('http://example.com/test.json');
            expect(body).toBe('404 Not Found');
        }
    });

    test('getJSON, aborted', async () => {
        const abortController = new AbortController();
        server.respondWith(request => {
            request.respond(404, undefined, '404 Not Found');
        });
        const promise = getJSON({url: 'http://example.com/test.json'}, abortController);
        abortController.abort();
        server.respond();

        try {
            await promise;
        } catch (error) {
            expect(error.name).toBe('AbortError');
            expect(isAbortError(error)).toBe(true);
        }
    });

    test('getJSON with fetch, aborted', async () => {
        // Mock Request.prototype.signal to simulate environment with fetch and AbortController support
        Object.defineProperty(Request.prototype, 'signal', {});

        // Re-enable fetch for this test
        global.fetch = originalFetch;

        const abortController = new AbortController();
        server.respondWith(request => {
            request.respond(404, undefined, '404 Not Found');
        });
        const promise = getJSON({url: 'http://example.com/test.json'}, abortController);
        abortController.abort();
        server.respond();

        try {
            await promise;
        } catch (error) {
            expect(error.name).toBe('AbortError');
            expect(isAbortError(error)).toBe(true);
        }
    });

    test('sameOrigin method', () => {
        vi.spyOn(window, 'location', 'get').mockReturnValue({
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
        vi.spyOn(window, 'location', 'get').mockReturnValue({
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

        test('should be provided to fetch API in getArrayBuffer function', async () => {
            server.respondWith(new ArrayBuffer(1));

            const promise = getArrayBuffer({url: 'http://example.com/test-params.json', cache: 'force-cache', headers: {'Authorization': 'Bearer 123'}}, new AbortController());
            server.respond();
            await promise;

            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe('http://example.com/test-params.json');
            expect(server.requests[0].method).toBe('GET');
            expect(server.requests[0].requestHeaders['Authorization']).toBe('Bearer 123');
        });

        test('should be provided to fetch API in getJSON function', async () => {

            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
            });

            const promise = getJSON({url: 'http://example.com/test-params.json', cache: 'force-cache', headers: {'Authorization': 'Bearer 123'}}, new AbortController());
            server.respond();
            await promise;

            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe('http://example.com/test-params.json');
            expect(server.requests[0].method).toBe('GET');
            expect(server.requests[0].requestHeaders['Authorization']).toBe('Bearer 123');
        });

        test('should preserve user-specified Accept header', async () => {
            server.respondWith(request => {
                // Note that PostgREST responds to this type of request with application/geo+json
                request.respond(200, {'Content-Type': 'application/geo+json'}, '{"foo": "bar"}');
            });

            const promise = getJSON({url: 'http://example.com/test-params.json', cache: 'force-cache', headers: {'Authorization': 'Bearer 123', 'Accept': 'application/geo+json'}}, new AbortController());
            server.respond();
            await promise;

            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe('http://example.com/test-params.json');
            expect(server.requests[0].method).toBe('GET');
            expect(server.requests[0].requestHeaders['Authorization']).toBe('Bearer 123');
            expect(server.requests[0].requestHeaders['Accept']).toBe('application/geo+json');
        });

        test('should add default Accept header when user has not specified one', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
            });

            const promise = getJSON({url: 'http://example.com/test-params.json', cache: 'force-cache', headers: {'Authorization': 'Bearer 123'}}, new AbortController());
            server.respond();
            await promise;

            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe('http://example.com/test-params.json');
            expect(server.requests[0].method).toBe('GET');
            expect(server.requests[0].requestHeaders['Authorization']).toBe('Bearer 123');
            expect(server.requests[0].requestHeaders['Accept']).toBe('application/json');
        });

        test('should add default Accept header when user has not specified one, even for file:// requests', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
            });

            const promise = getJSON({url: 'file:///C:/Temp/abc.json', cache: 'force-cache', headers: {'Authorization': 'Bearer 123'}}, new AbortController());
            server.respond();
            await promise;

            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe('file:///C:/Temp/abc.json');
            expect(server.requests[0].method).toBe('GET');
            expect(server.requests[0].requestHeaders['Authorization']).toBe('Bearer 123');
            expect(server.requests[0].requestHeaders['Accept']).toBe('application/json');
        });

        test('should not add default Accept header when user has already specified one, even for file:// requests', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
            });

            const promise = getJSON({url: 'file:///C:/Temp/abc.json', cache: 'force-cache', headers: {'Authorization': 'Bearer 123', 'Accept': 'application/geo+json'}}, new AbortController());
            server.respond();
            await promise;

            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe('file:///C:/Temp/abc.json');
            expect(server.requests[0].method).toBe('GET');
            expect(server.requests[0].requestHeaders['Authorization']).toBe('Bearer 123');
            expect(server.requests[0].requestHeaders['Accept']).toBe('application/geo+json');
        });

    });
});

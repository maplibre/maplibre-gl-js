import {
    getArrayBuffer,
    getJSON,
    postData,
    getImage,
    resetImageRequestQueue,
    AJAXError
} from './ajax';
import config from './config';
import webpSupported from './webp_supported';
import {fakeServer, FakeServer} from 'nise';
import {stubAjaxGetImage} from './test/util';
import expect from 'expect';

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

    describe('getJSON', () => {
        test('ok', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
            });

            try {
                const request = getJSON({url: ''});
                server.respond();

                const response = await request.response;
                expect(response.data).toEqual({foo: 'bar'});
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('404', async () => {
            server.respondWith(request => {
                request.respond(404);
            });

            const request = getJSON({url: ''});
            server.respond();

            await expect(request.response).rejects.toBeInstanceOf(AJAXError);
        });

        test('invalid json', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, 'how do i even');
            });

            const request = getJSON({url: ''});
            server.respond();

            await expect(request.response).rejects.toBeInstanceOf(SyntaxError);
        });
    });

    describe('getArrayBuffer', () => {
        test('ok', async () => {
            server.respondWith(request => {
                request.respond(200, undefined, new ArrayBuffer(0)[Symbol.toStringTag]);
            });

            try {
                const request = getArrayBuffer({url: ''});
                server.respond();

                const response = await request.response;
                expect(response.data).toBeInstanceOf(ArrayBuffer);
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('404', async () => {
            server.respondWith(request => {
                request.respond(404);
            });

            const request = getArrayBuffer({url: ''});
            server.respond();

            await expect(request.response).rejects.toBeInstanceOf(AJAXError);
        });
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

    test('getImage respects maxParallelImageRequests', done => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        function callback(err) {
            if (err) return;
            // last request is only added after we got a response from one of the previous ones
            expect(server.requests).toHaveLength(maxRequests + 1);
            done();
        }

        for (let i = 0; i < maxRequests + 1; i++) {
            getImage({url: ''}, callback);
        }
        expect(server.requests).toHaveLength(maxRequests);

        server.requests[0].respond(undefined, undefined, undefined);
    });

    test('getImage cancelling frees up request for maxParallelImageRequests', done => {
        resetImageRequestQueue();

        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        for (let i = 0; i < maxRequests + 1; i++) {
            getImage({url: ''}, () => done('test failed: getImage callback was called')).cancel();
        }
        expect(server.requests).toHaveLength(maxRequests + 1);
        done();
    });

    test('getImage requests that were once queued are still abortable', done => {
        resetImageRequestQueue();

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const requests = [];
        for (let i = 0; i < maxRequests; i++) {
            requests.push(getImage({url: ''}, () => {}));
        }

        // the limit of allowed requests is reached
        expect(server.requests).toHaveLength(maxRequests);

        const queuedURL = 'this-is-the-queued-request';
        const queued = getImage({url: queuedURL}, () => done('test failed: getImage callback was called'));

        // the new requests is queued because the limit is reached
        expect(server.requests).toHaveLength(maxRequests);

        // cancel the first request to let the queued request start
        requests[0].cancel();
        expect(server.requests).toHaveLength(maxRequests + 1);

        // abort the previously queued request and confirm that it is aborted
        const queuedRequest = server.requests[server.requests.length - 1];
        expect(queuedRequest.url).toBe(queuedURL);
        expect((queuedRequest as any).aborted).toBeUndefined();
        queued.cancel();
        expect((queuedRequest as any).aborted).toBe(true);

        done();
    });

    test('getImage sends accept/webp when supported', done => {
        resetImageRequestQueue();

        server.respondWith((request) => {
            expect(request.requestHeaders.accept.includes('image/webp')).toBeTruthy();
            request.respond(200, {'Content-Type': 'image/webp'}, '');
        });

        // mock webp support
        webpSupported.supported = true;

        getImage({url: ''}, () => { done(); });

        server.respond();
    });

    test('getImage uses ImageBitmap when supported', done => {
        resetImageRequestQueue();

        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        stubAjaxGetImage(() => Promise.resolve(new ImageBitmap()));

        getImage({url: ''}, (err, img, expiry) => {
            if (err) done(err);
            expect(img).toBeInstanceOf(ImageBitmap);
            expect(expiry.cacheControl).toBe('cache');
            expect(expiry.expires).toBe('expires');
            done();
        });

        server.respond();
    });

    test('getImage uses HTMLImageElement when ImageBitmap is not supported', done => {
        resetImageRequestQueue();

        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        stubAjaxGetImage(undefined);

        getImage({url: ''}, (err, img, expiry) => {
            if (err) done(`get image failed with error ${err.message}`);
            expect(img).toBeInstanceOf(HTMLImageElement);
            expect(expiry.cacheControl).toBe('cache');
            expect(expiry.expires).toBe('expires');
            done();
        });

        server.respond();
    });

});

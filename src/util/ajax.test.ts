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
        getArrayBuffer({url:'http://example.com/test.bin'}, async (error) => {
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
        getJSON({url:''}, (error, body) => {
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
        getJSON({url:''}, (error) => {
            expect(error).toBeTruthy();
            done();
        });
        server.respond();
    });

    test('getJSON, 404', done => {
        server.respondWith(request => {
            request.respond(404, undefined, '404 Not Found');
        });
        getJSON({url:'http://example.com/test.json'}, async (error) => {
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
        postData({url:'api.mapbox.com'}, (error) => {
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

        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        stubAjaxGetImage(() => Promise.resolve(new ImageBitmap()));

        getImage({url: ''}, (err, img) => {
            if (err) done(err);
            expect(img).toBeInstanceOf(ImageBitmap);
            done();
        });

        server.respond();
    });

    test('getImage uses HTMLImageElement when ImageBitmap is not supported', done => {
        resetImageRequestQueue();

        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        stubAjaxGetImage(undefined);

        getImage({url: ''}, (err, img) => {
            if (err) done(`get image failed with error ${err.message}`);
            expect(img).toBeInstanceOf(HTMLImageElement);
            done();
        });

        server.respond();
    });

});

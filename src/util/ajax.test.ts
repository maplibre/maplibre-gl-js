import '../../stub_loader';
import {
    getArrayBuffer,
    getJSON,
    postData,
    getImage,
    resetImageRequestQueue
} from '../util/ajax';
import config from '../util/config';
import webpSupported from '../util/webp_supported';

describe('ajax', done => {
    t.beforeEach(callback => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach(callback => {
        window.clearFakeXMLHttpRequest();
        callback();
    });

    test('getArrayBuffer, 404', done => {
        window.server.respondWith(request => {
            request.respond(404);
        });
        getArrayBuffer({url:''}, (error) => {
            expect(error.status).toBe(404);
            done();
        });
        window.server.respond();
    });

    test('getJSON', done => {
        window.server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
        });
        getJSON({url:''}, (error, body) => {
            expect(error).toBeFalsy();
            expect(body).toEqual({foo: 'bar'});
            done();
        });
        window.server.respond();
    });

    test('getJSON, invalid syntax', done => {
        window.server.respondWith(request => {
            request.respond(200, {'Content-Type': 'application/json'}, 'how do i even');
        });
        getJSON({url:''}, (error) => {
            expect(error).toBeTruthy();
            done();
        });
        window.server.respond();
    });

    test('getJSON, 404', done => {
        window.server.respondWith(request => {
            request.respond(404);
        });
        getJSON({url:''}, (error) => {
            expect(error.status).toBe(404);
            done();
        });
        window.server.respond();
    });

    test('getJSON, 401: non-Mapbox domain', done => {
        window.server.respondWith(request => {
            request.respond(401);
        });
        getJSON({url:''}, (error) => {
            expect(error.status).toBe(401);
            expect(error.message).toBe('Unauthorized');
            done();
        });
        window.server.respond();
    });

    test('postData, 204(no content): no error', done => {
        window.server.respondWith(request => {
            request.respond(204);
        });
        postData({url:'api.mapbox.com'}, (error) => {
            expect(error).toBeNull();
            done();
        });
        window.server.respond();
    });

    test('getImage respects maxParallelImageRequests', done => {
        window.server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        function callback(err) {
            if (err) return;
            // last request is only added after we got a response from one of the previous ones
            expect(window.server.requests).toHaveLength(maxRequests + 1);
            done();
        }

        for (let i = 0; i < maxRequests + 1; i++) {
            getImage({url: ''}, callback);
        }
        expect(window.server.requests).toHaveLength(maxRequests);

        window.server.requests[0].respond();
    });

    test('getImage cancelling frees up request for maxParallelImageRequests', done => {
        resetImageRequestQueue();

        window.server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        for (let i = 0; i < maxRequests + 1; i++) {
            getImage({url: ''}, () => t.fail).cancel();
        }
        expect(window.server.requests).toHaveLength(maxRequests + 1);
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
        expect(window.server.requests).toHaveLength(maxRequests);

        const queuedURL = 'this-is-the-queued-request';
        const queued = getImage({url: queuedURL}, () => t.fail());

        // the new requests is queued because the limit is reached
        expect(window.server.requests).toHaveLength(maxRequests);

        // cancel the first request to let the queued request start
        requests[0].cancel();
        expect(window.server.requests).toHaveLength(maxRequests + 1);

        // abort the previously queued request and confirm that it is aborted
        const queuedRequest = window.server.requests[window.server.requests.length - 1];
        expect(queuedRequest.url).toBe(queuedURL);
        expect(queuedRequest.aborted).toBeUndefined();
        queued.cancel();
        expect(queuedRequest.aborted).toBe(true);

        done();
    });

    test('getImage sends accept/webp when supported', done => {
        resetImageRequestQueue();

        window.server.respondWith((request) => {
            expect(request.requestHeaders.accept.includes('image/webp')).toBeTruthy();
            request.respond(200, {'Content-Type': 'image/webp'}, '');
        });

        // mock webp support
        webpSupported.supported = true;

        getImage({url: ''}, () => { t.end(); });

        window.server.respond();
    });

    test('getImage uses ImageBitmap when supported', done => {
        resetImageRequestQueue();

        window.server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        // mock createImageBitmap support
        global.createImageBitmap = () => Promise.resolve(new ImageBitmap());

        getImage({url: ''}, (err, img) => {
            if (err) t.fail();
            expect(img instanceof ImageBitmap).toBeTruthy();
            done();
        });

        window.server.respond();
    });

    test('getImage uses HTMLImageElement when ImageBitmap is not supported', done => {
        resetImageRequestQueue();

        window.server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        // mock createImageBitmap not supported
        global.createImageBitmap = undefined;

        getImage({url: ''}, (err, img) => {
            if (err) t.fail();
            expect(img instanceof HTMLImageElement).toBeTruthy();
            done();
        });

        window.server.respond();
    });

    done();
});

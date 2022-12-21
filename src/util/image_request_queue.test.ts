import {
    getImage,
    resetImageRequestQueue,
    processImageRequestQueue,
    installImageQueueThrottleControlCallback,
    removeImageQueueThrottleControlCallback
} from './image_request_queue';

import config from './config';
import webpSupported from './webp_supported';
import {fakeServer, FakeServer} from 'nise';
import {stubAjaxGetImage} from './test/util';

describe('image_request_queue', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });
    afterEach(() => {
        server.restore();
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

    test('when throttling enabled, getImage queues requests for later processing', done => {
        resetImageRequestQueue();

        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME_WHILE_THROTTLED;

        const isThrottling = true;
        const callbackHandle = installImageQueueThrottleControlCallback(() => isThrottling);

        let isProcessingRequests = false;
        function callback(err) {
            if (err) return;
            // request processing is only allowed when explicitly called
            if (!isProcessingRequests) {
                done('test failed: requests processed automatically in spite of throttling being enabled');
            }
        }

        for (let i = 0; i < maxRequests + 1; i++) {
            getImage({url: ''}, callback);
        }

        // with throttling enabled, no requests should have been proessed yet
        expect(server.requests).toHaveLength(0);

        // process all of the pending requests
        isProcessingRequests = true;
        processImageRequestQueue(maxRequests + 1);

        // all the pending requests should have been processed
        expect(server.requests).toHaveLength(maxRequests + 1);

        removeImageQueueThrottleControlCallback(callbackHandle);

        done();
    });

});

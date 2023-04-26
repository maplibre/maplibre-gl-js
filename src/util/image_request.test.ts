import config from './config';
import webpSupported from './webp_supported';
import {stubAjaxGetImage} from './test/util';
import {fakeServer, FakeServer} from 'nise';
import ImageRequest, {ImageRequestQueueItem} from './image_request';
import * as ajax from './ajax';

describe('ImageRequest', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
        ImageRequest.resetRequestQueue();
        stubAjaxGetImage(undefined);
    });
    afterEach(() => {
        server.restore();
    });

    test('getImage respects maxParallelImageRequests', done => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;
        let callbackCount = 0;
        function callback(err) {
            if (err) return;
            // last request is only added after we got a response from one of the previous ones
            expect(server.requests).toHaveLength(maxRequests + callbackCount);
            callbackCount++;
            if (callbackCount === 2) {
                done();
            }
        }

        for (let i = 0; i < maxRequests + 1; i++) {
            ImageRequest.getImage({url: ''}, callback);
        }
        expect(server.requests).toHaveLength(maxRequests);

        server.requests[0].respond(undefined, undefined, undefined);
        server.requests[1].respond(undefined, undefined, undefined);
    });

    test('getImage cancelling frees up request for maxParallelImageRequests', done => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        for (let i = 0; i < maxRequests + 1; i++) {
            ImageRequest.getImage({url: ''}, () => done('test failed: getImage callback was called')).cancel();
        }
        expect(server.requests).toHaveLength(maxRequests + 1);
        done();
    });

    test('getImage requests that were once queued are still abortable', done => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const requests = [];
        for (let i = 0; i < maxRequests; i++) {
            requests.push(ImageRequest.getImage({url: ''}, () => {}));
        }

        // the limit of allowed requests is reached
        expect(server.requests).toHaveLength(maxRequests);

        const queuedURL = 'this-is-the-queued-request';
        const queued = ImageRequest.getImage({url: queuedURL}, () => done('test failed: getImage callback was called'));

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
        server.respondWith((request) => {
            expect(request.requestHeaders.accept.includes('image/webp')).toBeTruthy();
            request.respond(200, {'Content-Type': 'image/webp'}, '');
        });

        // mock webp support
        webpSupported.supported = true;

        ImageRequest.getImage({url: ''}, () => { done(); });

        server.respond();
    });

    test('getImage uses createImageBitmap when supported', done => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        stubAjaxGetImage(() => Promise.resolve(new ImageBitmap()));

        ImageRequest.getImage({url: ''}, (err, img, expiry) => {
            if (err) done(err);
            expect(img).toBeInstanceOf(ImageBitmap);
            expect(expiry.cacheControl).toBe('cache');
            expect(expiry.expires).toBe('expires');
            done();
        });

        server.respond();
    });

    test('getImage using createImageBitmap throws exception', done => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        stubAjaxGetImage(() => Promise.reject(new Error('error')));

        ImageRequest.getImage({url: ''}, (err, img) => {
            expect(img).toBeFalsy();
            if (err) done();
        });

        server.respond();
    });

    test('getImage uses HTMLImageElement when createImageBitmap is not supported', done => {
        const makeRequestSky = jest.spyOn(ajax, 'makeRequest');
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        ImageRequest.getImage({url: ''}, (err, img, expiry) => {
            if (err) done(`get image failed with error ${err.message}`);
            expect(img).toBeInstanceOf(HTMLImageElement);
            expect(expiry.cacheControl).toBe('cache');
            expect(expiry.expires).toBe('expires');
            done();
        });

        server.respond();
        expect(makeRequestSky).toHaveBeenCalledTimes(1);
        makeRequestSky.mockClear();
    });

    test('getImage using HTMLImageElement with same-origin credentials', done => {
        const makeRequestSky = jest.spyOn(ajax, 'makeRequest');
        ImageRequest.getImage({url: '', credentials: 'same-origin'}, (err, img: HTMLImageElement) => {
            if (err) done(err);
            expect(img).toBeInstanceOf(HTMLImageElement);
            expect(img.crossOrigin).toBe('anonymous');
            done();
        }, false);

        expect(makeRequestSky).toHaveBeenCalledTimes(0);
        makeRequestSky.mockClear();
    });

    test('getImage using HTMLImageElement with include credentials', done => {
        const makeRequestSky = jest.spyOn(ajax, 'makeRequest');
        ImageRequest.getImage({url: '', credentials: 'include'}, (err, img: HTMLImageElement) => {
            if (err) done(err);
            expect(img).toBeInstanceOf(HTMLImageElement);
            expect(img.crossOrigin).toBe('use-credentials');
            done();
        }, false);

        expect(makeRequestSky).toHaveBeenCalledTimes(0);
        makeRequestSky.mockClear();
    });

    test('getImage using HTMLImageElement with accept header', done => {
        const makeRequestSky = jest.spyOn(ajax, 'makeRequest');
        ImageRequest.getImage({url: '', credentials: 'include', headers: {accept: 'accept'}},
            (err, img: HTMLImageElement) => {
                if (err) done(err);
                expect(img).toBeInstanceOf(HTMLImageElement);
                expect(img.crossOrigin).toBe('use-credentials');
                done();
            }, false);

        expect(makeRequestSky).toHaveBeenCalledTimes(0);
        makeRequestSky.mockClear();
    });

    test('getImage uses makeRequest when custom Headers are added', () => {
        const makeRequestSky = jest.spyOn(ajax, 'makeRequest');

        ImageRequest.getImage({url: '', credentials: 'include', headers: {custom: 'test', accept: 'image'}},
            () => {},
            false);

        expect(makeRequestSky).toHaveBeenCalledTimes(1);
        makeRequestSky.mockClear();
    });

    test('getImage request returned 404 response for fetch request', done => {
        server.respondWith(request => request.respond(404));

        ImageRequest.getImage({url: ''}, (err) => {
            if (err) done();
            else done('Image download should have failed');
        });

        server.respond();
    });

    test('getImage request failed for HTTPImageRequest', done => {
        ImageRequest.getImage({url: 'error'}, (err) => {
            if (err) done();
            else done('Image download should have failed');
        }, false);
    });

    test('getImage request cancelled for HTTPImageRequest', done => {
        let imageUrl;
        const requestUrl = 'test';
        // eslint-disable-next-line accessor-pairs
        Object.defineProperty(global.Image.prototype, 'src', {
            set(url: string) {
                imageUrl = url;
            }
        });

        const request = ImageRequest.getImage({url: requestUrl}, () => {
            done('Callback should not be called in case image request is cancelled');
        }, false);

        expect(imageUrl).toBe(requestUrl);
        expect(request.cancelled).toBeFalsy();
        request.cancel();
        expect(request.cancelled).toBeTruthy();
        expect(imageUrl).toBe('');
        done();
    });

    test('getImage request cancelled', done => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        const request = ImageRequest.getImage({url: ''}, () => {
            done('Callback should not be called in case image request is cancelled');
        });

        expect(request.cancelled).toBeFalsy();
        request.cancel();
        expect(request.cancelled).toBeTruthy();

        server.respond();
        done();
    });

    test('throttling: getImage queues requests for later processing', done => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;
        const callbackHandle = ImageRequest.addThrottleControl(() => true);

        let callbackCounter = 0;
        function callback() {
            callbackCounter++;
        }

        for (let i = 0; i < maxRequests + 1; i++) {
            ImageRequest.getImage({url: ''}, callback);
        }

        // with throttling enabled, no requests should have been proessed yet
        expect(server.requests).toHaveLength(0);

        // process pending requests up to maxRequests
        ImageRequest.processQueue();
        expect(server.requests).toHaveLength(maxRequests);

        // all pending
        expect(callbackCounter).toBe(0);

        ImageRequest.removeThrottleControl(callbackHandle);
        done();
    });

    test('throttling: do NOT advance to next item when one of them is completed', done => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;
        const callbackHandle = ImageRequest.addThrottleControl(() => true);

        let callbackCounter = 0;
        function callback() {
            callbackCounter++;
        }

        // make 1 more request for testing
        const imageResults: ImageRequestQueueItem[] = [];
        for (let i = 0; i < maxRequests + 1; i++) {
            imageResults.push(ImageRequest.getImage({url: ''}, callback));
        }

        // with throttling enabled, no requests should have been processed yet
        expect(server.requests).toHaveLength(0);

        // process all of the pending requests
        ImageRequest.processQueue();

        // process requests up to maxRequests
        expect(server.requests).toHaveLength(maxRequests);

        // finish one of them
        const itemIndexToComplete = 3;
        server.requests[itemIndexToComplete].respond(200, undefined, undefined);

        // Should still be maxRequests, because it does NOT fetch the next round
        expect(server.requests).toHaveLength(maxRequests);

        expect(callbackCounter).toBe(1);
        expect(server.requests[itemIndexToComplete].status).toBe(200);

        // everything should still be pending except itemIndexToComplete
        for (let i = 0; i < maxRequests + 1; i++) {
            expect(imageResults[i].completed).toBe(i === itemIndexToComplete);
        }

        ImageRequest.removeThrottleControl(callbackHandle);

        done();
    });

    test('throttling: DO advance to next item when one of them is canceled', done => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;
        const callbackHandle = ImageRequest.addThrottleControl(() => true);

        let callbackCounter = 0;
        function callback() {
            callbackCounter++;
        }

        // make 1 more request for testing
        const imageResults: ImageRequestQueueItem[] = [];
        for (let i = 0; i < maxRequests + 1; i++) {
            imageResults.push(ImageRequest.getImage({url: ''}, callback));
        }

        // with throttling enabled, no requests should have been proessed yet
        expect(server.requests).toHaveLength(0);

        // process all of the pending requests
        ImageRequest.processQueue();

        // process requests up to maxRequests
        expect(server.requests).toHaveLength(maxRequests);

        // cancel 1
        const itemIndexToCancel = 1;
        imageResults[itemIndexToCancel].cancel();

        // should have one more now
        expect(server.requests).toHaveLength(maxRequests + 1);

        expect(callbackCounter).toBe(0);
        expect(server.requests[itemIndexToCancel].status).toBe(0);
        expect((server.requests[itemIndexToCancel] as any).aborted).toBe(true);

        // everything should still be pending except itemIndexToComplete
        for (let i = 0; i < maxRequests + 1; i++) {
            expect(imageResults[i].cancelled).toBe(i === itemIndexToCancel);
        }

        ImageRequest.removeThrottleControl(callbackHandle);

        done();
    });

    test('throttling: process next item only when processQueue is called again', done => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;

        const isThrottling = true;
        const callbackHandle = ImageRequest.addThrottleControl(() => isThrottling);

        let callbackCounter = 0;
        function callback() {
            callbackCounter++;
        }

        // make 1 more request for testing
        const imageResults: ImageRequestQueueItem[] = [];
        for (let i = 0; i < maxRequests + 1; i++) {
            imageResults.push(ImageRequest.getImage({url: ''}, callback));
        }

        // with throttling enabled, no requests should have been proessed yet
        expect(server.requests).toHaveLength(0);

        // process all of the pending requests
        ImageRequest.processQueue();

        // process requests up to maxRequests
        expect(server.requests).toHaveLength(maxRequests);

        // finish one of them
        const itemIndexToComplete = 4;
        server.requests[itemIndexToComplete].respond(200, undefined, undefined);

        // Should still be maxRequests, because it does NOT fetch the next round
        expect(server.requests).toHaveLength(maxRequests);

        expect(callbackCounter).toBe(1);
        expect(server.requests[itemIndexToComplete].status).toBe(200);

        // everything should still be pending except itemIndexToComplete
        for (let i = 0; i < maxRequests + 1; i++) {
            expect(imageResults[i].completed).toBe(i === itemIndexToComplete);
        }

        // process again in next frame
        ImageRequest.processQueue();
        expect(server.requests).toHaveLength(maxRequests + 1);

        ImageRequest.removeThrottleControl(callbackHandle);

        done();
    });

    test('throttling: one throttling client will result in throttle behavior for all', done => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;
        const callbackHandles = [];

        // add one for each
        callbackHandles.push(ImageRequest.addThrottleControl(() => false));
        callbackHandles.push(ImageRequest.addThrottleControl(() => true));

        let callbackCounter = 0;
        function callback() {
            callbackCounter++;
        }

        for (let i = 0; i < maxRequests + 1; i++) {
            ImageRequest.getImage({url: ''}, callback);
        }

        // with throttling enabled, no requests should have been proessed yet
        expect(server.requests).toHaveLength(0);

        // process pending requests up to maxRequests
        ImageRequest.processQueue();
        expect(server.requests).toHaveLength(maxRequests);

        // all pending
        expect(callbackCounter).toBe(0);

        for (const handle of callbackHandles) {
            ImageRequest.removeThrottleControl(handle);
        }
        done();
    });

    test('throttling: image queue will process all requests if throttling control returns false', done => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;
        const controlId = ImageRequest.addThrottleControl(() => false);

        let callbackCounter = 0;
        function callback() {
            callbackCounter++;
        }

        for (let i = 0; i < maxRequests + 1; i++) {
            ImageRequest.getImage({url: ''}, callback);
        }

        // all should be processed because throttle control is returning false
        expect(server.requests).toHaveLength(maxRequests + 1);

        // all pending
        expect(callbackCounter).toBe(0);

        ImageRequest.removeThrottleControl(controlId);
        done();
    });

    test('throttling: removing throttling client will process all requests', done => {
        const requestParameter = {'Content-Type': 'image/png', url: ''};
        server.respondWith(request => request.respond(200, requestParameter, ''));
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;

        // add 10, and one of them is throttling
        const throttlingIndex = 5;
        for (let i = 0; i < 10; i++) {
            const throttlingClient: boolean = (i === throttlingIndex);
            ImageRequest.addThrottleControl(() => throttlingClient);
        }

        let callbackCounter = 0;
        function callback() {
            callbackCounter++;
        }

        // make 2 times + 1 more requests
        const requestsMade = 2 * maxRequests + 1;
        const imageResults: ImageRequestQueueItem[] = [];
        for (let i = 0; i < requestsMade; i++) {
            imageResults.push(ImageRequest.getImage(requestParameter, callback));
        }

        // with throttling enabled, no requests should have been proessed yet
        expect(server.requests).toHaveLength(0);

        // process all of the pending requests
        ImageRequest.processQueue();

        // up to the config value
        expect(server.requests).toHaveLength(maxRequests);

        const itemIndexToComplete = 6;
        server.requests[itemIndexToComplete].respond(200, undefined, undefined);

        // unleash it by removing teh throttling client
        ImageRequest.removeThrottleControl(throttlingIndex);
        ImageRequest.processQueue();
        expect(server.requests).toHaveLength(requestsMade);

        // all pending
        expect(callbackCounter).toBe(1);

        // everything should still be pending except itemIndexToComplete
        for (let i = 0; i < maxRequests + 1; i++) {
            expect(imageResults[i].completed).toBe(i === itemIndexToComplete);
        }

        done();
    });
});

import config from './config';
import webpSupported from './webp_supported';
import {stubAjaxGetImage} from './test/util';
import {fakeServer, FakeServer} from 'nise';
import {
    getArrayBuffer,
    getJSON,
    postData,
    AJAXError
} from './ajax';

import ImageRequest, {ImageRequestQueueItem} from './image_request';

function readAsText(blob) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = () => reject(fileReader.error);
        fileReader.readAsText(blob);
    });
}

describe('ImageRequest', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
        ImageRequest.resetRequestQueue();
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
            ImageRequest.getImage({url: ''}, callback);
        }
        expect(server.requests).toHaveLength(maxRequests);
        server.requests[0].respond(200, {'Content-Type': 'image/png'}, 'test');
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

    test('getImage uses ImageBitmap when supported', done => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, 'test'));

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

    test('getImage uses HTMLImageElement when ImageBitmap is not supported', done => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, 'test'));

        stubAjaxGetImage(undefined);

        ImageRequest.getImage({url: ''}, (err, img, expiry) => {
            if (err) done(`get image failed with error ${err.message}`);
            expect(img).toBeInstanceOf(HTMLImageElement);
            expect(expiry.cacheControl).toBe('cache');
            expect(expiry.expires).toBe('expires');
            done();
        });

        server.respond();
    });

    test('getImage handles request errors', done => {
        server.respondWith(request => {
            request.respond(404, undefined, '404 Not Found');
        });

        const callback = async (error) => {
            const ajaxError = error as AJAXError;
            const body = await readAsText(ajaxError.body);
            expect(ajaxError.status).toBe(404);
            expect(ajaxError.statusText).toBe('Not Found');
            expect(ajaxError.url).toBe('http://example.com/test.json');
            expect(body).toBe('404 Not Found');
            done();
        };

        ImageRequest.getImage({url: 'http://example.com/test.json'}, callback);
        server.respond();
    });

    test('getImage does not error when response has no data', done => {
        server.respondWith(request => {
            request.respond(204, undefined, undefined);
        });

        const callback = (error, image) => {
            expect(error).toBeNull();
            expect(image).toBeNull();
            done();
        };

        ImageRequest.getImage({url: ''}, callback);
        server.respond();
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

        // with throttling enabled, no requests should have been proessed yet
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

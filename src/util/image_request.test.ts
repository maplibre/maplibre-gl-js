import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {config} from './config';
import {webpSupported} from './webp_supported';
import {sleep, stubAjaxGetImage} from './test/util';
import {fakeServer, type FakeServer} from 'nise';
import {ImageRequest} from './image_request';
import {isAbortError} from './abort_error';
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

    test('getImage respects maxParallelImageRequests', async () => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png'}, ''));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const promises: Promise<any>[] = [];
        for (let i = 0; i < maxRequests + 5; i++) {
            promises.push(ImageRequest.getImage({url: ''}, new AbortController()));

        }
        expect(server.requests).toHaveLength(maxRequests);

        server.requests[0].respond(200);
        await promises[0];
        expect(server.requests).toHaveLength(maxRequests + 1);
        server.requests[1].respond(200);
        await promises[1];
        expect(server.requests).toHaveLength(maxRequests + 2);
    });

    test('getImage respects maxParallelImageRequests and continues to respond even when server returns 404', async () => {
        server.respondWith(request => request.respond(404));

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        for (let i = 0; i < maxRequests + 5; i++) {
            ImageRequest.getImage({url: ''}, new AbortController()).catch(() => {});
        }
        expect(server.requests).toHaveLength(maxRequests);
        server.respond();
        await sleep(0);
        expect(server.requests).toHaveLength(maxRequests + 5);
    });

    test('Cancel: getImage cancelling frees up request for maxParallelImageRequests', async () => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        for (let i = 0; i < maxRequests + 1; i++) {
            const abortController = new AbortController();
            ImageRequest.getImage({url: ''}, abortController).catch((e) => expect(isAbortError(e)).toBeTruthy());
            abortController.abort();
            await sleep(0);
        }
        expect(server.requests).toHaveLength(maxRequests + 1);
    });

    test('Cancel: getImage requests that were once queued are still abortable', async () => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const abortControllers: AbortController[] = [];
        for (let i = 0; i < maxRequests; i++) {
            const abortController = new AbortController();
            abortControllers.push(abortController);
            ImageRequest.getImage({url: ''}, abortController).catch(() => {});
        }

        // the limit of allowed requests is reached
        expect(server.requests).toHaveLength(maxRequests);

        const queuedURL = 'this-is-the-queued-request';
        const abortController = new AbortController();
        ImageRequest.getImage({url: queuedURL}, abortController).catch((e) => expect(isAbortError(e)).toBeTruthy());

        // the new requests is queued because the limit is reached
        expect(server.requests).toHaveLength(maxRequests);

        // cancel the first request to let the queued request start
        abortControllers[0].abort();
        await sleep(0);
        expect(server.requests).toHaveLength(maxRequests + 1);

        // abort the previously queued request and confirm that it is aborted
        const queuedRequest = server.requests[server.requests.length - 1];
        expect(queuedRequest.url).toBe(queuedURL);
        expect((queuedRequest as any).aborted).toBeUndefined();
        abortController.abort();
        expect((queuedRequest as any).aborted).toBe(true);
    });

    test('getImage sends accept/webp when supported', async () => {
        server.respondWith((request) => {
            expect(request.requestHeaders.accept.includes('image/webp')).toBeTruthy();
            request.respond(200, {'Content-Type': 'image/webp'}, '');
        });

        // mock webp support
        webpSupported.supported = true;

        const promise = ImageRequest.getImage({url: ''}, new AbortController());

        server.respond();

        await expect(promise).resolves.toBeDefined();
    });

    test('getImage uses createImageBitmap when supported', async () => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        stubAjaxGetImage(() => Promise.resolve(new ImageBitmap()));
        const promise = ImageRequest.getImage({url: ''}, new AbortController());
        server.respond();

        const response = await promise;

        expect(response.data).toBeInstanceOf(ImageBitmap);
        expect(response.cacheControl).toBe('cache');
        expect(response.expires).toBe('expires');
    });

    test('getImage using createImageBitmap throws exception', async () => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        stubAjaxGetImage(() => Promise.reject(new Error('error')));

        const promise = ImageRequest.getImage({url: ''}, new AbortController());

        server.respond();

        await expect(promise).rejects.toThrow();
    });

    test('getImage uses HTMLImageElement when createImageBitmap is not supported', async () => {
        const makeRequestSky = vi.spyOn(ajax, 'makeRequest');
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        const promise = ImageRequest.getImage({url: ''}, new AbortController());

        server.respond();
        expect(makeRequestSky).toHaveBeenCalledTimes(1);
        makeRequestSky.mockClear();
        const response = await promise;
        expect(response.data).toBeInstanceOf(HTMLImageElement);
        expect(response.cacheControl).toBe('cache');
        expect(response.expires).toBe('expires');
    });

    test('getImage using HTMLImageElement with same-origin credentials', async () => {
        const makeRequestSky = vi.spyOn(ajax, 'makeRequest');
        const promise = ImageRequest.getImage({url: '', credentials: 'same-origin'}, new AbortController(), false);

        expect(makeRequestSky).toHaveBeenCalledTimes(0);
        makeRequestSky.mockClear();

        const response = await promise;

        expect(response.data).toBeInstanceOf(HTMLImageElement);
        expect((response.data as HTMLImageElement).crossOrigin).toBe('anonymous');
    });

    test('getImage using HTMLImageElement with include credentials', async () => {
        const makeRequestSky = vi.spyOn(ajax, 'makeRequest');
        const promise = ImageRequest.getImage({url: '', credentials: 'include'}, new AbortController(), false);

        expect(makeRequestSky).toHaveBeenCalledTimes(0);
        makeRequestSky.mockClear();

        const response = await promise;

        expect(response.data).toBeInstanceOf(HTMLImageElement);
        expect((response.data as HTMLImageElement).crossOrigin).toBe('use-credentials');
    });

    test('getImage using HTMLImageElement with accept header', async () => {
        const makeRequestSky = vi.spyOn(ajax, 'makeRequest');
        const promise = ImageRequest.getImage({url: '', credentials: 'include', headers: {accept: 'accept'}}, new AbortController(), false);

        expect(makeRequestSky).toHaveBeenCalledTimes(0);
        makeRequestSky.mockClear();

        const response = await promise;
        expect(response.data).toBeInstanceOf(HTMLImageElement);
        expect((response.data as HTMLImageElement).crossOrigin).toBe('use-credentials');
    });

    test('getImage uses makeRequest when custom Headers are added', () => {
        const makeRequestSky = vi.spyOn(ajax, 'makeRequest');

        ImageRequest.getImage({url: '', credentials: 'include', headers: {custom: 'test', accept: 'image'}}, new AbortController(), false);

        expect(makeRequestSky).toHaveBeenCalledTimes(1);
        makeRequestSky.mockClear();
    });

    test('getImage request returned 404 response for fetch request', async () => {
        server.respondWith(request => request.respond(404));

        const promise = ImageRequest.getImage({url: ''}, new AbortController());

        server.respond();

        await expect(promise).rejects.toThrow('Not Found');
    });

    test('getImage request failed for HTTPImageRequest', async () => {
        const promise = ImageRequest.getImage({url: 'error'},  new AbortController(), false);
        await expect(promise).rejects.toThrow(/Could not load image.*/);
    });

    test('Cancel: getImage request cancelled for HTTPImageRequest', async () => {
        let imageUrl;
        const requestUrl = 'test';
        Object.defineProperty(global.Image.prototype, 'src', {
            set(url: string) {
                imageUrl = url;
            }
        });

        const abortController = new AbortController();
        ImageRequest.getImage({url: requestUrl}, abortController, false).catch(() => {});

        expect(imageUrl).toBe(requestUrl);
        expect(abortController.signal.aborted).toBeFalsy();
        abortController.abort();
        expect(abortController.signal.aborted).toBeTruthy();
        expect(imageUrl).toBe('');
    });

    test('Cancel: getImage request cancelled', async () => {
        server.respondWith(request => request.respond(200, {'Content-Type': 'image/png',
            'Cache-Control': 'cache',
            'Expires': 'expires'}, ''));

        const abortController = new AbortController();
        let response = false;
        ImageRequest.getImage({url: ''}, abortController)
            .then(() => { response = true; })
            .catch(() => { response = true; });

        abortController.abort();

        server.respond();

        expect(response).toBeFalsy();
    });

    test('Cancel: Cancellation of an image which has not yet been requested', async () => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        let callbackCounter = 0;
        const promiseCallback = () => { callbackCounter++; };

        const abortConstollers: {url: string; abortController: AbortController}[] = [];
        for (let i = 0; i < maxRequests + 100; i++) {
            const url = `${i}`;
            const abortController = new AbortController();
            abortConstollers.push({url, abortController});
            ImageRequest.getImage({url}, abortController).then(promiseCallback).catch(() => {});
        }

        abortConstollers[0].abortController.abort();
        await sleep(0);
        // Queue should move forward and next request is made
        expect(server.requests).toHaveLength(maxRequests + 1);

        // Cancel request should not call callback
        expect(callbackCounter).toBe(0);

        // Cancel request which is not yet issued. It should not fire callback
        const nextRequestInQueue = abortConstollers[server.requests.length];
        const cancelledImageUrl = nextRequestInQueue.url;
        nextRequestInQueue.abortController.abort();

        // Queue should not move forward as cancelled image was sitting in queue
        expect(server.requests).toHaveLength(maxRequests + 1);
        expect(callbackCounter).toBe(0);

        // On server response, next image queued should not be the cancelled image
        server.requests[1].respond(200);
        await sleep(0);
        expect(callbackCounter).toBe(1);
        expect(server.requests).toHaveLength(maxRequests + 2);
        // Verify that the last request made skipped the cancelled image request
        expect(server.requests[server.requests.length - 1].url).toBe((parseInt(cancelledImageUrl) + 1).toString());
    });

    test('throttling: one throttling client will result in throttle behavior for all', () => {
        const maxRequestsPerFrame = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;
        const callbackHandles = [];

        // add one for each
        callbackHandles.push(ImageRequest.addThrottleControl(() => false));
        callbackHandles.push(ImageRequest.addThrottleControl(() => true));

        let callbackCounter = 0;
        const promiseCallback = () => { callbackCounter++; };

        for (let i = 0; i < maxRequestsPerFrame + 1; i++) {
            ImageRequest.getImage({url: ''}, new AbortController()).then(promiseCallback);
        }

        expect(server.requests).toHaveLength(maxRequestsPerFrame);

        // all pending
        expect(callbackCounter).toBe(0);

        for (const handle of callbackHandles) {
            ImageRequest.removeThrottleControl(handle);
        }
    });

    test('throttling: image queue will process MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME if throttling control returns true', () => {
        const maxRequestsPerFrame = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;
        const controlId = ImageRequest.addThrottleControl(() => true);

        let callbackCounter = 0;
        const promiseCallback = () => { callbackCounter++; };

        for (let i = 0; i < maxRequests; i++) {
            ImageRequest.getImage({url: ''}, new AbortController()).then(promiseCallback);
        }

        // Should only fire request to a max allowed per frame
        expect(server.requests).toHaveLength(maxRequestsPerFrame);

        // all pending
        expect(callbackCounter).toBe(0);

        ImageRequest.removeThrottleControl(controlId);
    });

    test('throttling: image queue will process MAX_PARALLEL_IMAGE_REQUESTS if throttling control returns false', () => {
        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;
        const controlId = ImageRequest.addThrottleControl(() => false);

        let callbackCounter = 0;
        const promiseCallback = () => { callbackCounter++; };

        for (let i = 0; i < maxRequests + 100; i++) {
            ImageRequest.getImage({url: ''}, new AbortController()).then(promiseCallback);
        }

        // all should be processed because throttle control is returning false
        expect(server.requests).toHaveLength(maxRequests);

        // all pending
        expect(callbackCounter).toBe(0);

        ImageRequest.removeThrottleControl(controlId);
    });

    test('throttling: removing throttling client will process all requests', async () => {
        const requestParameter = {'Content-Type': 'image/png', url: ''};
        const maxRequestsPerFrame = config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME;

        // add 10, and one of them is throttling
        const throttlingIndex = 5;
        for (let i = 0; i < 10; i++) {
            const throttlingClient: boolean = (i === throttlingIndex);
            ImageRequest.addThrottleControl(() => throttlingClient);
        }

        // make 2 times + 1 more requests
        const requestsMade = 2 * maxRequestsPerFrame + 1;
        const completedMap: {[index: number]: boolean} = {};
        for (let i = 0; i < requestsMade; i++) {
            const promise = ImageRequest.getImage(requestParameter, new AbortController());
            promise.catch(() => {});
            promise.then(() => { completedMap[i] = true; });
        }

        // up to the config value
        expect(server.requests).toHaveLength(maxRequestsPerFrame);

        const itemIndexToComplete = 6;
        server.requests[itemIndexToComplete].respond(200);

        // unleash it by removing the throttling client
        ImageRequest.removeThrottleControl(throttlingIndex);
        await sleep(0);
        expect(server.requests).toHaveLength(requestsMade);

        // all pending
        expect(Object.keys(completedMap)).toHaveLength(1);

        // everything should still be pending except itemIndexToComplete
        for (let i = 0; i < maxRequestsPerFrame + 1; i++) {
            expect(completedMap[i]).toBe(i === itemIndexToComplete ? true : undefined);
        }
    });
});

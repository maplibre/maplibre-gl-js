import type {Cancelable} from '../types/cancelable';
import {RequestParameters, ExpiryData, makeRequest, sameOrigin, getProtocolAction} from './ajax';
import type {Callback} from '../types/callback';

import {arrayBufferToImageBitmap, arrayBufferToImage, extend, isWorker, isImageBitmap} from './util';
import {webpSupported} from './webp_supported';
import {config} from './config';

/**
 * The callback that is being called after an image was fetched
 */
export type GetImageCallback = (error?: Error | null, image?: HTMLImageElement | ImageBitmap | null, expiry?: ExpiryData | null) => void;

type ImageQueueThrottleControlCallback = () => boolean;

export type ImageRequestQueueItem  = Cancelable & {
    requestParameters: RequestParameters;
    supportImageRefresh: boolean;
    callback: GetImageCallback;
    cancelled: boolean;
    completed: boolean;
    innerRequest?: Cancelable;
}

type ImageQueueThrottleCallbackDictionary = {
    [Key: number]: ImageQueueThrottleControlCallback;
}

type HTMLImageElementWithPriority = HTMLImageElement &
{
    // fetchPriority is experimental property supported on Chromium browsers from Version 102
    // By default images are downloaded with priority low, whereas fetch request downloads with priority high
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/fetchPriority
    fetchPriority?: 'auto' | 'high' | 'low';
};

/**
 * By default, the image queue is self driven, meaning as soon as one requested item is processed,
 * it will move on to next one as quickly as it can while limiting
 * the number of concurrent requests to MAX_PARALLEL_IMAGE_REQUESTS. The default behavior
 * ensures that static views of the map can be rendered with minimal delay.
 *
 * However, the default behavior can prevent dynamic views of the map from rendering
 * smoothly in that many requests can finish in one render frame, putting too much pressure on GPU.
 *
 * When the view of the map is moving dynamically, smoother frame rates can be achieved
 * by throttling the number of items processed by the queue per frame. This can be
 * accomplished by using {@link addThrottleControl} to allow the caller to
 * use a lambda function to determine when the queue should be throttled (e.g. when isMoving())
 * and manually calling {@link processQueue} in the render loop.
 */
export namespace ImageRequest {
    let imageRequestQueue : ImageRequestQueueItem[];
    let currentParallelImageRequests:number;

    let throttleControlCallbackHandleCounter: number;
    let throttleControlCallbacks: ImageQueueThrottleCallbackDictionary;

    /**
     * Reset the image request queue, removing all pending requests.
     */
    export const resetRequestQueue = (): void => {
        imageRequestQueue = [];
        currentParallelImageRequests = 0;
        throttleControlCallbackHandleCounter = 0;
        throttleControlCallbacks = {};
    };

    /**
     * Install a callback to control when image queue throttling is desired.
     * (e.g. when the map view is moving)
     * @param callback - The callback function to install
     * @returns handle that identifies the installed callback.
     */
    export const addThrottleControl = (callback: ImageQueueThrottleControlCallback): number => {
        const handle = throttleControlCallbackHandleCounter++;
        throttleControlCallbacks[handle] = callback;
        return handle;
    };

    /**
     * Remove a previously installed callback by passing in the handle returned
     * by {@link addThrottleControl}.
     * @param callbackHandle - The handle for the callback to remove.
     */
    export const removeThrottleControl = (callbackHandle: number): void => {
        delete throttleControlCallbacks[callbackHandle];
        // Try updating the queue
        processQueue();
    };

    /**
     * Check to see if any of the installed callbacks are requesting the queue
     * to be throttled.
     * @returns `true` if any callback is causing the queue to be throttled.
     */
    const isThrottled = (): boolean => {
        const allControlKeys = Object.keys(throttleControlCallbacks);
        let throttleingRequested = false;
        if (allControlKeys.length > 0)        {
            for (const key of allControlKeys) {
                throttleingRequested = throttleControlCallbacks[key]();
                if (throttleingRequested) {
                    break;
                }
            }
        }
        return throttleingRequested;
    };

    /**
     * Request to load an image.
     * @param requestParameters - Request parameters.
     * @param callback - Callback to issue when the request completes.
     * @param supportImageRefresh - `true`, if the image request need to support refresh based on cache headers.
     * @returns Cancelable request.
     */
    export const getImage = (
        requestParameters: RequestParameters,
        callback: GetImageCallback,
        supportImageRefresh: boolean = true
    ): ImageRequestQueueItem => {
        if (webpSupported.supported) {
            if (!requestParameters.headers) {
                requestParameters.headers = {};
            }
            requestParameters.headers.accept = 'image/webp,*/*';
        }

        const request:ImageRequestQueueItem = {
            requestParameters,
            supportImageRefresh,
            callback,
            cancelled: false,
            completed: false,
            cancel: () => {
                if (!request.completed && !request.cancelled) {
                    request.cancelled = true;

                    // Only reduce currentParallelImageRequests, if the image request was issued.
                    if (request.innerRequest) {
                        request.innerRequest.cancel();
                        currentParallelImageRequests--;
                    }

                    // in the case of cancelling, it WILL move on
                    processQueue();
                }
            }
        };

        imageRequestQueue.push(request);
        processQueue();
        return request;
    };

    const arrayBufferToCanvasImageSource = (data: ArrayBuffer, callback: Callback<CanvasImageSource>) => {
        const imageBitmapSupported = typeof createImageBitmap === 'function';
        if (imageBitmapSupported) {
            arrayBufferToImageBitmap(data, callback);
        } else {
            arrayBufferToImage(data, callback);
        }
    };

    const doImageRequest = (itemInQueue: ImageRequestQueueItem): Cancelable => {
        const {requestParameters, supportImageRefresh, callback} = itemInQueue;
        extend(requestParameters, {type: 'image'});

        // - If refreshExpiredTiles is false, then we can use HTMLImageElement to download raster images.
        // - Fetch/XHR (via MakeRequest API) will be used to download images for following scenarios:
        //      1. Style image sprite will had a issue with HTMLImageElement as described
        //          here: https://github.com/mapbox/mapbox-gl-js/issues/1470
        //      2. If refreshExpiredTiles is true (default), then in order to read the image cache header,
        //          fetch/XHR request will be required
        // - For any special case handling like use of AddProtocol, worker initiated request or additional headers
        //      let makeRequest handle it.
        // - HtmlImageElement request automatically adds accept header for all the browser supported images
        const canUseHTMLImageElement = supportImageRefresh === false &&
            !isWorker() &&
            !getProtocolAction(requestParameters.url) &&
            (!requestParameters.headers ||
                Object.keys(requestParameters.headers).reduce((acc, item) => acc && item === 'accept', true));

        const action = canUseHTMLImageElement ? getImageUsingHtmlImage : makeRequest;
        return action(
            requestParameters,
            (err?: Error | null,
                data?: HTMLImageElement | ImageBitmap | ArrayBuffer | null,
                cacheControl?: string | null,
                expires?: string | null) => {
                onImageResponse(itemInQueue, callback, err, data, cacheControl, expires);
            });
    };

    const onImageResponse = (
        itemInQueue: ImageRequestQueueItem,
        callback:GetImageCallback,
        err?: Error | null,
        data?: HTMLImageElement | ImageBitmap | ArrayBuffer | null,
        cacheControl?: string | null,
        expires?: string | null): void => {
        if (err) {
            callback(err);
        } else if (data instanceof HTMLImageElement || isImageBitmap(data)) {
            // User using addProtocol can directly return HTMLImageElement/ImageBitmap type
            // If HtmlImageElement is used to get image then response type will be HTMLImageElement
            callback(null, data);
        } else if (data) {
            const decoratedCallback = (imgErr?: Error | null, imgResult?: CanvasImageSource | null) => {
                if (imgErr != null) {
                    callback(imgErr);
                } else if (imgResult != null) {
                    callback(null, imgResult as (HTMLImageElement | ImageBitmap), {cacheControl, expires});
                }
            };
            arrayBufferToCanvasImageSource(data, decoratedCallback);
        }
        if (!itemInQueue.cancelled) {
            itemInQueue.completed = true;
            currentParallelImageRequests--;

            processQueue();
        }
    };

    /**
     * Process some number of items in the image request queue.
     */
    const processQueue = (): void => {

        const maxImageRequests = isThrottled() ?
            config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME :
            config.MAX_PARALLEL_IMAGE_REQUESTS;

        // limit concurrent image loads to help with raster sources performance on big screens
        for (let numImageRequests = currentParallelImageRequests;
            numImageRequests < maxImageRequests && imageRequestQueue.length > 0;
            numImageRequests++) {

            const topItemInQueue: ImageRequestQueueItem = imageRequestQueue.shift();
            if (topItemInQueue.cancelled) {
                numImageRequests--;
                continue;
            }

            const innerRequest = doImageRequest(topItemInQueue);

            currentParallelImageRequests++;

            topItemInQueue.innerRequest = innerRequest;
        }
    };

    const getImageUsingHtmlImage = (requestParameters: RequestParameters, callback: GetImageCallback): Cancelable  => {
        const image = new Image() as HTMLImageElementWithPriority;
        const url = requestParameters.url;
        let requestCancelled = false;
        const credentials = requestParameters.credentials;
        if (credentials && credentials === 'include') {
            image.crossOrigin = 'use-credentials';
        } else if ((credentials && credentials === 'same-origin') || !sameOrigin(url)) {
            image.crossOrigin = 'anonymous';
        }

        image.fetchPriority = 'high';
        image.onload = () => {
            callback(null, image);
            image.onerror = image.onload = null;
        };
        image.onerror = () => {
            if (!requestCancelled) {
                callback(new Error('Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.'));
            }
            image.onerror = image.onload = null;
        };
        image.src = url;
        return {
            cancel: () => {
                requestCancelled = true;
                // Set src to '' to actually cancel the request
                image.src = '';
            }
        };
    };
}

ImageRequest.resetRequestQueue();

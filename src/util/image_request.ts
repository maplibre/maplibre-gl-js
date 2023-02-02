import type {Cancelable} from '../types/cancelable';
import type {RequestParameters, ExpiryData} from './ajax';
import type {Callback} from '../types/callback';

import {arrayBufferToImageBitmap, arrayBufferToImage} from './util';
import {getArrayBuffer} from './ajax';
import webpSupported from './webp_supported';
import config from './config';

export type GetImageCallback = (error?: Error | null, image?: HTMLImageElement | ImageBitmap | null, expiry?: ExpiryData | null) => void;

type ImageQueueThrottleControlCallback = () => boolean;

export type ImageRequestQueueItem  = Cancelable & {
    requestParameters: RequestParameters;
    callback: GetImageCallback;
    cancelled: boolean;
    completed: boolean;
    innerRequest?: Cancelable;
}

type ImageQueueThrottleCallbackDictionary = {
    [Key: number]: ImageQueueThrottleControlCallback;
}

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
namespace ImageRequest {
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
     * @param {ImageQueueThrottleControlCallback} callback The callback function to install
     * @returns {number} handle that identifies the installed callback.
     */
    export const addThrottleControl = (callback: ImageQueueThrottleControlCallback): number /*callbackHandle*/ => {
        const handle = throttleControlCallbackHandleCounter++;
        throttleControlCallbacks[handle] = callback;
        return handle;
    };

    /**
     * Remove a previously installed callback by passing in the handle returned
     * by {@link addThrottleControl}.
     * @param {number} callbackHandle The handle for the callback to remove.
     */
    export const removeThrottleControl = (callbackHandle: number): void => {
        delete throttleControlCallbacks[callbackHandle];
    };

    /**
     * Check to see if any of the installed callbacks are requesting the queue
     * to be throttled.
     * @returns {boolean} true if any callback is causing the queue to be throttled.
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
     * @param {RequestParameters} requestParameters Request parameters.
     * @param {GetImageCallback} callback Callback to issue when the request completes.
     * @returns {Cancelable} Cancelable request.
     */
    export const getImage = (
        requestParameters: RequestParameters,
        callback: GetImageCallback
    ): ImageRequestQueueItem => {
        if (webpSupported.supported) {
            if (!requestParameters.headers) {
                requestParameters.headers = {};
            }
            requestParameters.headers.accept = 'image/webp,*/*';
        }

        const queued:ImageRequestQueueItem = {
            requestParameters,
            callback,
            cancelled: false,
            completed: false,

            // Just a place holder. The real one will be assigned during processQueue()
            cancel: () => {}
        };
        imageRequestQueue.push(queued);

        if (!isThrottled()) {
            processQueue();
        }

        return queued;
    };

    const arrayBufferToCanvasImageSource = (data: ArrayBuffer, callback: Callback<CanvasImageSource>) => {
        const imageBitmapSupported = typeof createImageBitmap === 'function';
        if (imageBitmapSupported) {
            arrayBufferToImageBitmap(data, callback);
        } else {
            arrayBufferToImage(data, callback);
        }
    };

    const doArrayRequest = (itemInQueue: ImageRequestQueueItem): Cancelable => {

        const {requestParameters, callback} = itemInQueue;

        // request the image with XHR to work around caching issues
        // see https://github.com/mapbox/mapbox-gl-js/issues/1470
        return getArrayBuffer(requestParameters, (err?: Error | null, data?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {
            if (err) {
                callback(err);
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

                if (!isThrottled()) {
                    processQueue();
                }
            }
        });
    };

    /**
     * Process some number of items in the image request queue.
     * @param {number} maxImageRequests The maximum number of request items to process. By default, up to {@link Config.MAX_PARALLEL_IMAGE_REQUESTS} will be procesed.
     * @returns {number} The number of items remaining in the queue.
     */
    export const processQueue = (
        maxImageRequests: number = 0): number => {

        if (maxImageRequests <= 0) {
            maxImageRequests = isThrottled() ? config.MAX_PARALLEL_IMAGE_REQUESTS_FRAME : config.MAX_PARALLEL_IMAGE_REQUESTS;
        }

        const cancelRequest = (request: ImageRequestQueueItem) => {
            if (!request.completed && !request.cancelled) {
                currentParallelImageRequests--;
                request.cancelled = true;
                request.innerRequest.cancel();

                // in the case of cancelling, it WILL move on
                processQueue();
            }
        };

        // limit concurrent image loads to help with raster sources performance on big screens

        for (let numImageRequests = currentParallelImageRequests;
            numImageRequests < maxImageRequests && imageRequestQueue.length > 0;
            numImageRequests++) {

            const topItemInQueue: ImageRequestQueueItem = imageRequestQueue.shift();
            if (topItemInQueue.cancelled) {
                continue;
            }

            const innerRequest = doArrayRequest(topItemInQueue);

            currentParallelImageRequests++;

            topItemInQueue.innerRequest = innerRequest;
            topItemInQueue.cancel = () => cancelRequest(topItemInQueue);
        }

        return imageRequestQueue.length;
    };
}

ImageRequest.resetRequestQueue();

export default ImageRequest;

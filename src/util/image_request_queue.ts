import config from './config';
import webpSupported from './webp_supported';

import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import {
    RequestParameters,
    ExpiryData,
    getArrayBuffer,
} from './ajax';

const transparentPngUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';

function arrayBufferToImage(data: ArrayBuffer, callback: (err?: Error | null, image?: HTMLImageElement | null) => void) {
    const img: HTMLImageElement = new Image();
    img.onload = () => {
        callback(null, img);
        URL.revokeObjectURL(img.src);
        // prevent image dataURI memory leak in Safari;
        // but don't free the image immediately because it might be uploaded in the next frame
        // https://github.com/mapbox/mapbox-gl-js/issues/10226
        img.onload = null;
        window.requestAnimationFrame(() => { img.src = transparentPngUrl; });
    };
    img.onerror = () => callback(new Error('Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.'));
    const blob: Blob = new Blob([new Uint8Array(data)], {type: 'image/png'});
    img.src = data.byteLength ? URL.createObjectURL(blob) : transparentPngUrl;
}

function arrayBufferToImageBitmap(data: ArrayBuffer, callback: (err?: Error | null, image?: ImageBitmap | null) => void) {
    const blob: Blob = new Blob([new Uint8Array(data)], {type: 'image/png'});
    createImageBitmap(blob).then((imgBitmap) => {
        callback(null, imgBitmap);
    }).catch((e) => {
        callback(new Error(`Could not load image because of ${e.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`));
    });
}

function arrayBufferToCanvasImageSource(data: ArrayBuffer, callback: Callback<CanvasImageSource>) {
    const imageBitmapSupported = typeof createImageBitmap === 'function';
    if (imageBitmapSupported) {
        arrayBufferToImageBitmap(data, callback);
    } else {
        arrayBufferToImage(data, callback);
    }
}

let imageQueue;
let currentParallelImageRequests = 0;
export const resetImageRequestQueue = () => {
    imageQueue = [];
    currentParallelImageRequests = 0;
};
resetImageRequestQueue();

// By default, the image queue will process requests as quickly as it can while limiting
// the number of concurrent requests to MAX_PARALLEL_IMAGE_REQUESTS. The default behavior
// ensures that static views of the map can be rendered with minimal delay.
// However, the default behavior can prevent dynamic views of the map from rendering
// smoothly.
//
// When the view of the map is moving dynamically, smoother frame rates can be achieved
// by throttling the number of items processed by the queue per frame. This can be
// accomplished by using installImageQueueThrottleControlCallback() to allow the caller to
// use a lambda function to determine when the queue should be throttled (e.g. when isMoving())
// and manually calling processImageRequestQueue() in the render loop.

export type ImageQueueThrottleControlCallback = () => boolean;

let imageQueueThrottleControlCallbackHandleCounter: number = 0;
const imageQueueThrottleControlCallbacks = [];

// Install a callback to control when image queue throttling is desired (e.g. when the map view is moving).
export const installImageQueueThrottleControlCallback = function (callback: ImageQueueThrottleControlCallback): number /*callbackHandle*/ {
    const handle = imageQueueThrottleControlCallbackHandleCounter++;
    imageQueueThrottleControlCallbacks[handle] = callback;
    return handle;
};

// Remove a previously installed callback by passing in the handle returned by installImageQueueThrottleControlCallback().
export const removeImageQueueThrottleControlCallback = function (callbackHandle: number) {
    const index = imageQueueThrottleControlCallbacks.indexOf(callbackHandle, 0);
    if (index >= 0) {
        imageQueueThrottleControlCallbacks.splice(index, 1);
    }
};

// Check to see if any of the installed callbacks are requesting the queue to be throttled.
const isImageQueueThrottled = function (): boolean {
    return imageQueueThrottleControlCallbacks.some(item => item());
};

export type GetImageCallback = (error?: Error | null, image?: HTMLImageElement | ImageBitmap | null, expiry?: ExpiryData | null) => void;

export const getImage = function(
    requestParameters: RequestParameters,
    callback: GetImageCallback
): Cancelable {
    if (webpSupported.supported) {
        if (!requestParameters.headers) {
            requestParameters.headers = {};
        }
        requestParameters.headers.accept = 'image/webp,*/*';
    }

    const queued = {
        requestParameters,
        callback,
        cancelled: false,
        completed: false,
        cancel() {
            this.cancelled = true;

            if (!isImageQueueThrottled()) {
                processImageRequestQueue(config.MAX_PARALLEL_IMAGE_REQUESTS);
            }
        }
    };
    imageQueue.push(queued);

    if (!isImageQueueThrottled()) {
        processImageRequestQueue(config.MAX_PARALLEL_IMAGE_REQUESTS);
    }

    return queued;
};

function doArrayRequest(requestParameters: RequestParameters, callback: GetImageCallback, request: any): Cancelable {
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

        if (!request.cancelled) {
            request.completed = true;
            currentParallelImageRequests--;

            if (!isImageQueueThrottled()) {
                processImageRequestQueue(config.MAX_PARALLEL_IMAGE_REQUESTS);
            }
        }
    });
}

export const processImageRequestQueue = function (
    maxImageRequests: number = 0) {

    if (!maxImageRequests) {
        maxImageRequests = Math.max(0, isImageQueueThrottled() ? config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME_WHILE_THROTTLED : config.MAX_PARALLEL_IMAGE_REQUESTS);
    }

    const cancelRequest = function (request: any) {
        if (!request.completed && !request.cancelled) {
            currentParallelImageRequests--;
            request.cancelled = true;
            request.innerRequest.cancel();

            if (!isImageQueueThrottled()) {
                processImageRequestQueue();
            }
        }
    };

    // limit concurrent image loads to help with raster sources performance on big screens

    for (let numImageRequests = currentParallelImageRequests; numImageRequests < maxImageRequests && imageQueue.length; numImageRequests++) {

        const request = imageQueue.shift();
        const {requestParameters, callback, cancelled} = request;

        if (cancelled) {
            continue;
        }

        const innerRequest = doArrayRequest(requestParameters, callback, request);

        currentParallelImageRequests++;

        request.innerRequest = innerRequest;
        request.cancel = function () { cancelRequest(request); };
    }

    return imageQueue.length;
};

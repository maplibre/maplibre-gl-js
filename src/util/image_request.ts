import {type RequestParameters, makeRequest, sameOrigin, type GetResourceResponse} from './ajax';
import {arrayBufferToImageBitmap, arrayBufferToImage, extend, isWorker, isImageBitmap} from './util';
import {webpSupported} from './webp_supported';
import {config} from './config';
import {createAbortError} from './abort_error';
import {getProtocol} from '../source/protocol_crud';

type ImageQueueThrottleControlCallback = () => boolean;

export type ImageRequestQueueItem  = {
    requestParameters: RequestParameters;
    supportImageRefresh: boolean;
    state: 'queued' | 'running' | 'completed';
    abortController: AbortController;
    onError: (error: Error) => void;
    onSuccess: (response: GetResourceResponse<HTMLImageElement | ImageBitmap | null>) => void;
};

type ImageQueueThrottleCallbackDictionary = {
    [Key: number]: ImageQueueThrottleControlCallback;
};

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
        for (const key of Object.keys(throttleControlCallbacks)) {
            if (throttleControlCallbacks[key]()) {
                return true;
            }
        }
        return false;
    };

    /**
     * Request to load an image.
     * @param requestParameters - Request parameters.
     * @param abortController - allows to abort the request.
     * @param supportImageRefresh - `true`, if the image request need to support refresh based on cache headers.
     * @returns - A promise resolved when the image is loaded.
     */
    export const getImage = (requestParameters: RequestParameters, abortController: AbortController, supportImageRefresh: boolean = true): Promise<GetResourceResponse<HTMLImageElement | ImageBitmap | null>> => {
        return new Promise<GetResourceResponse<HTMLImageElement | ImageBitmap | null>>((resolve, reject) => {
            if (webpSupported.supported) {
                if (!requestParameters.headers) {
                    requestParameters.headers = {};
                }
                requestParameters.headers.accept = 'image/webp,*/*';
            }
            extend(requestParameters, {type: 'image'});
            const request: ImageRequestQueueItem = {
                abortController,
                requestParameters,
                supportImageRefresh,
                state: 'queued',
                onError: (error: Error) => {
                    reject(error);
                },
                onSuccess: (response) => {
                    resolve(response);
                }
            };

            imageRequestQueue.push(request);
            processQueue();
        });
    };

    const arrayBufferToCanvasImageSource = (data: ArrayBuffer): Promise<HTMLImageElement | ImageBitmap | null> => {
        const imageBitmapSupported = typeof createImageBitmap === 'function';
        if (imageBitmapSupported) {
            return arrayBufferToImageBitmap(data);
        } else {
            return arrayBufferToImage(data);
        }
    };

    const doImageRequest = async (itemInQueue: ImageRequestQueueItem) => {
        itemInQueue.state = 'running';
        const {requestParameters, supportImageRefresh, onError, onSuccess, abortController} = itemInQueue;
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
            !isWorker(self) &&
            !getProtocol(requestParameters.url) &&
            (!requestParameters.headers ||
                Object.keys(requestParameters.headers).reduce((acc, item) => acc && item === 'accept', true));

        currentParallelImageRequests++;

        const getImagePromise = canUseHTMLImageElement ?
            getImageUsingHtmlImage(requestParameters, abortController) :
            makeRequest(requestParameters, abortController);

        try {
            const response = await getImagePromise;
            delete itemInQueue.abortController;
            itemInQueue.state = 'completed';
            if (response.data instanceof HTMLImageElement || isImageBitmap(response.data)) {
                // User using addProtocol can directly return HTMLImageElement/ImageBitmap type
                // If HtmlImageElement is used to get image then response type will be HTMLImageElement
                onSuccess(response as GetResourceResponse<HTMLImageElement | ImageBitmap | null>);
            } else if (response.data) {
                const img = await arrayBufferToCanvasImageSource(response.data);
                onSuccess({data: img, cacheControl: response.cacheControl, expires: response.expires});
            }
        } catch (err) {
            delete itemInQueue.abortController;
            onError(err);
        } finally {
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
            if (topItemInQueue.abortController.signal.aborted) {
                numImageRequests--;
                continue;
            }
            doImageRequest(topItemInQueue);
        }
    };

    const getImageUsingHtmlImage = (requestParameters: RequestParameters, abortController: AbortController): Promise<GetResourceResponse<HTMLImageElement | ImageBitmap | null>>  => {
        return new Promise<GetResourceResponse<HTMLImageElement | ImageBitmap | null>>((resolve, reject) => {

            const image = new Image() as HTMLImageElementWithPriority;
            const url = requestParameters.url;
            const credentials = requestParameters.credentials;
            if (credentials && credentials === 'include') {
                image.crossOrigin = 'use-credentials';
            } else if ((credentials && credentials === 'same-origin') || !sameOrigin(url)) {
                image.crossOrigin = 'anonymous';
            }

            abortController.signal.addEventListener('abort', () => {
                // Set src to '' to actually cancel the request
                image.src = '';
                reject(createAbortError());
            });

            image.fetchPriority = 'high';
            image.onload = () => {
                image.onerror = image.onload = null;
                resolve({data: image});
            };
            image.onerror = () => {
                image.onerror = image.onload = null;
                if (abortController.signal.aborted) {
                    return;
                }
                reject(new Error('Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.'));
            };
            image.src = url;
        });
    };
}

ImageRequest.resetRequestQueue();

import type {Cancelable} from '../types/cancelable';
import type {ExpiryData} from '../types/caching';
import {extend, isWorker} from './util';
import config from './config';
import webpSupported from './webp_supported';
import pLimit from 'p-limit';

/**
 * A type that represents parameters of an asynchronous HTTP request. The same as built-in `RequestInit`, but with
 * required `url: string` and optional `collectResourceTiming?: boolean` additional properties.
 *
 * @typedef {MapLibreRequestParameters}
 */
export type MapLibreRequestParameters = RequestInit & { url: string; collectResourceTiming?: boolean };

/**
 * A type that tells the `makeRequest` which modifications to apply to the request before making it and how to treat
 * response of the request after it's loaded based on the type of the raw data being loaded.
 *
 * @enum {MapLibreRequestDataType}
 */
export enum MapLibreRequestDataType {
    'string',
    'JSON',
    'ArrayBuffer'
}

/**
 * A generic type that represents a MapLibre asynchronous cancelable HTTP request.
 *
 * Represented by an object containing 2 fields:
 *  - `response`: a `Promise` that (possibly) resolves with the request's result
 *  - `cancel`: a function to cancel the request
 *
 * @typedef {MapLibreRequest}
 */
export type MapLibreRequest<T> = {response: Promise<T>} & Cancelable;

/**
 * A generic type that represents a MapLibre asynchronous cancelable HTTP request's response.
 *
 * Represented by an object containing 3 fields:
 *  - `data`: the response data
 *  - `cacheControl`: the value of the response's "Cache-Control" header
 *  - `expires`: the value of the response's "Expires" header
 *
 * @typedef {MapLibreResponse}
 */
export type MapLibreResponse<T> = {data: T} & ExpiryData;

/**
 * A generic function that loads JSON and returns an object containing 2 fields:
 *  - `response`: a `Promise` that rejects with an `Error` in case the request has failed to load the data and resolves
 *  with the value of type `MapLibreResponse<T>`
 *  - `cancel`: a method to cancel the request
 *
 * @function
 * @param {MapLibreRequestParameters} requestParameters Request parameters
 * @returns {MapLibreRequest<MapLibreResponse>} Promised response and the `cancel` method
 */
export function getJSON<T = Record<string, unknown> | unknown[]>(requestParameters: MapLibreRequestParameters): MapLibreRequest<MapLibreResponse<T>> {
    return helper.makeRequest<T>(requestParameters, MapLibreRequestDataType.JSON);
}

/**
 * Loads data as the `ArrayBuffer` and returns an object containing 2 fields:
 *  - `response`: a `Promise` that rejects with an `Error` in case the request has failed to load the data and resolves
 *  with the value of type `MapLibreResponse<ArrayBuffer>`
 *  - `cancel`: a method to cancel the request
 *
 * @function
 * @param {MapLibreRequestParameters} requestParameters Request parameters
 * @returns {MapLibreRequest<MapLibreResponse<ArrayBuffer>>} Promised response and the `cancel` method
 */
export function getArrayBuffer(requestParameters: MapLibreRequestParameters): MapLibreRequest<MapLibreResponse<ArrayBuffer>> {
    return helper.makeRequest(requestParameters, MapLibreRequestDataType.ArrayBuffer);
}

const imageRequestsQueue = pLimit(config.MAX_PARALLEL_IMAGE_REQUESTS);

/**
 * Loads an image as the `ImageBitmap` or `HTMLImageElement` (both the formats can be used as an image source for
 * canvases) and returns an object containing 2 fields:
 *  - `response`: a `Promise` that rejects with an `Error` in case the request has failed to load the data and resolves
 *  with the value of type `MapLibreResponse<ImageBitmap | HTMLImageElement>`
 *  - `cancel`: a method to cancel the request
 *
 * @function
 * @param {MapLibreRequestParameters} requestParameters Request parameters
 * @returns {MapLibreRequest<MapLibreResponse<ImageBitmap | HTMLImageElement>>} Promised response and the `cancel`
 * method
 */
export function getImage(requestParameters: MapLibreRequestParameters): MapLibreRequest<MapLibreResponse<ImageBitmap | HTMLImageElement>> {
    if (webpSupported.supported) {
        if (!requestParameters.headers) requestParameters.headers = {};
        requestParameters.headers['Accept'] = 'image/webp,*/*';
    }

    const localAbortController = new AbortController();

    const promisedResponse = imageRequestsQueue(() => {
        if (!localAbortController.signal.aborted) {
            const request = helper.getArrayBuffer(requestParameters);
            localAbortController.signal.addEventListener('abort', () => request.cancel());

            return request.response;
        }
    });

    return {
        response: (async () => {
            const response =  await promisedResponse;
            const image = await arrayBufferToCanvasImageSource(response.data);

            return {
                data: image,
                cacheControl: response.cacheControl,
                expires: response.expires
            };
        })(),

        cancel: () => localAbortController.abort()

    };
}

/**
 * Loads a video as the `HTMLVideoElement` from the provided URLs and returns an object containing 2 fields:
 *  - `response`: a `Promise` that rejects with an `Error` in case the request has failed to load the data and resolves
 *  with the value of type `MapLibreResponse<HTMLVideoElement>`
 *  - `cancel`: a method to cancel the request
 *
 * @function
 * @param {string[]} urls URLs to load the video from
 * @returns {MapLibreRequest<MapLibreResponse<HTMLVideoElement>>} Promised response and the `cancel` method
 */
export function getVideo(urls: string[]): MapLibreRequest<MapLibreResponse<HTMLVideoElement>> {
    const video: HTMLVideoElement = window.document.createElement('video');
    video.muted = true;

    function isSameOrigin(url: string) {
        const a: HTMLAnchorElement = window.document.createElement('a'); a.href = url;
        return a.origin === window.document.location.origin;
    }

    urls.forEach(url => {
        const s: HTMLSourceElement = window.document.createElement('source');
        if (!isSameOrigin(url)) video.crossOrigin = 'Anonymous';

        s.src = url;
        video.appendChild(s);
    });

    return {
        response: new Promise((res, rej) => {
            video.onloadstart = () => res({data: video});
            video.onerror = () => rej(new Error(`Failed to load the video from the following sources: ${urls.join(', ')}`));
        }),

        cancel: () => {},

        // for testing purposes only!
        // @ts-ignore
        _testForceLoadStart: () => {
            video.onloadstart(new Event('loadstart'));
        },

        // for testing purposes only!
        // @ts-ignore
        _testForceError: () => {
            video.onerror(new Event('error'));
        }
    };
}

/**
 * A generic function that makes an asynchronous HTTP request using the most appropriate for the given circumstances
 * API: either Fetch or XMLHttpRequest.
 *
 * The second argument - `requestDataType` - when present, applies certain modifications to the request headers and
 * response data parsing.
 *
 * Returns an object containing 2 fields:
 *  - `response`: a `Promise` that rejects with an `Error` in case the request has failed to load the data and resolves
 *  with the value of type `MapLibreResponse<T>`
 *  - `cancel`: a method to cancel the request
 *
 * @function
 * @param {MapLibreRequestParameters} requestParameters Request parameters
 * @param {MapLibreRequestDataType} requestDataType Request data type
 * @returns {MapLibreRequest<MapLibreResponse>} Promised response and the `cancel` method
 */
export function makeRequest<T>(requestParameters: MapLibreRequestParameters, requestDataType?: MapLibreRequestDataType): MapLibreRequest<MapLibreResponse<T>> {
    /*
        See https://github.com/maplibre/maplibre-gl-js/discussions/2004

        TL;DR: for the time being, it's still impossible to completely give up on using the XMLHttpRequest API. But
        that's a point to reconsider in the (hopefully near) future
     */

    // if the url uses some custom protocol. E.g. "custom://..."
    if (/:\/\//.test(requestParameters.url) && !(/^https?:|^file:/.test(requestParameters.url))) {
        // and if the request is made from inside a worker
        if (isWorker() && (self as any).worker && (self as any).worker.actor) {
            // then ask the main thread to make the request from there
            return (self as any).worker.actor.send('getResource', requestParameters, requestDataType);
        }

        // if it's not a worker
        if (!isWorker()) {
            // then check the protocol, and if there exists a custom handler for the protocol, then execute the custom
            // handler. Otherwise, make the request using the Fetch API
            const protocol = requestParameters.url.substring(0, requestParameters.url.indexOf('://'));
            const action = config.REGISTERED_PROTOCOLS[protocol] || helper.makeFetchRequest;

            return action(requestParameters, requestDataType);
        }
    }

    // if there's no protocol at all or the protocol is not `file://` (in comparison with the `if` block above, it can
    // now be `http[s]://`). E.g. "https://..." or "foo"
    if (!requestParameters.url.startsWith('file://')) {
        // and if Fetch API is supported by the target environment
        if (fetch && Request && AbortController && Object.prototype.hasOwnProperty.call(Request.prototype, 'signal')) {
            // then make a `fetch` request
            return helper.makeFetchRequest(requestParameters, requestDataType);
        }

        // if the function is called from a worker
        if (isWorker() && (self as any).worker && (self as any).worker.actor) {
            // ask the main thread to make the request
            return (self as any).worker.actor.send('getResource', requestParameters, requestDataType);
        }
    }

    // fallback to the XMLHttpRequest API. E.g. "file://..."
    return helper.makeXMLHttpRequest(requestParameters, requestDataType);
}

/**
 * Returns the current `referer`. It differs based on whether the function is invoked from the global code or from a
 * worker.
 *
 * @returns {string} Result
 */
export function getReferer(): string {
    if (isWorker()) {
        return (self as any).worker && (self as any).worker.referer;
    } else {
        if (window.location.protocol === 'blob:') {
            return window.parent.location.href;
        } else {
            return window.location.href;
        }
    }
}

// private functions go below this line. Private functions are dependencies of the public function above and are
// exported only to be able to be imported in the unit tests

/**
 * @private
 *
 * A generic function that makes an asynchronous HTTP request using the Fetch API.
 *
 * Returns an object containing 2 fields:
 *  - `response`: a `Promise` that rejects with an `Error` in case the request has failed to load the data and resolves
 *  with the value of type `MapLibreResponse<T>`
 *  - `cancel`: a method to cancel the request
 *
 * @function
 * @param {MapLibreRequestParameters} requestParameters Request parameters
 * @param {MapLibreRequestDataType} requestDataType Request data type
 * @returns {MapLibreRequest<MapLibreResponse>} Promised response and the `cancel` method
 */
export function makeFetchRequest<T>(requestParameters: MapLibreRequestParameters, requestDataType?: MapLibreRequestDataType): MapLibreRequest<MapLibreResponse<T>> {
    const abortController = new AbortController();

    const request = new Request(requestParameters.url, extend({}, requestParameters, {
        referer: getReferer(),
        signal: abortController.signal
    }));

    if (requestDataType === MapLibreRequestDataType.JSON) {
        request.headers.set('Accept', 'application/json');
    }

    return {
        response: (async (): Promise<MapLibreResponse<T>> => {
            const response = await fetch(request);

            if (abortController.signal.aborted) throw new Error('aborted');

            if (response.ok) {
                const data: T = await (requestDataType === MapLibreRequestDataType.ArrayBuffer ? response.arrayBuffer() : requestDataType === MapLibreRequestDataType.JSON ? response.json() : response.text());

                return {
                    data,
                    cacheControl: response.headers.get('Cache-Control') ?? undefined,
                    expires: response.headers.get('Expires') ?? undefined
                };

            } else {
                throw new Error('Failed to fetch URL'/*response.status, response.statusText, requestParameters.url, await response.blob()*/);
            }
        })(),

        cancel: () => abortController.abort()
    };
}

/**
 * @private
 *
 * A generic function that makes an asynchronous HTTP request using the XMLHttpRequest API.
 *
 * Returns an object containing 2 fields:
 *  - `response`: a `Promise` that rejects with an `Error` in case the request has failed to load the data and resolves
 *  with the value of type `MapLibreResponse<T>`
 *  - `cancel`: a method to cancel the request
 *
 * @function
 * @param {MapLibreRequestParameters} requestParameters Request parameters
 * @param {MapLibreRequestDataType} requestDataType Request data type
 * @returns {MapLibreRequest<MapLibreResponse>} Promised response and the `cancel` method
 */
export function makeXMLHttpRequest<T>(requestParameters: MapLibreRequestParameters, requestDataType?: MapLibreRequestDataType): MapLibreRequest<MapLibreResponse<T>> {
    const xhr: XMLHttpRequest = new XMLHttpRequest();
    xhr.open(requestParameters.method || 'GET', requestParameters.url, true);

    if (requestDataType === MapLibreRequestDataType.ArrayBuffer) {
        xhr.responseType = 'arraybuffer';
    }

    for (const k in requestParameters.headers) {
        xhr.setRequestHeader(k, requestParameters.headers[k]);
    }

    if (requestDataType === MapLibreRequestDataType.JSON) {
        xhr.responseType = 'text';
        xhr.setRequestHeader('Accept', 'application/json');
    }

    xhr.withCredentials = requestParameters.credentials === 'include';

    xhr.send(requestParameters.body?.toString());

    return {
        response: new Promise<MapLibreResponse<T>>((res, rej) => {
            xhr.onload = () => {
                if (((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) && xhr.response !== null) {
                    let data: T = xhr.response;

                    if (requestDataType === MapLibreRequestDataType.JSON) {
                        try {
                            data = JSON.parse(xhr.response);
                        } catch (err) {
                            return rej(err);
                        }
                    }

                    res({
                        data,
                        cacheControl: xhr.getResponseHeader('Cache-Control'),
                        expires: xhr.getResponseHeader('Expires')
                    });
                } else {
                    // const body = new Blob([xhr.response], {type: xhr.getResponseHeader('Content-Type')});
                    rej(new Error('Failed to Fetch URL'/*xhr.status, xhr.statusText, requestParameters.url, body*/));
                }
            };

            xhr.onerror = () => rej(new Error('Failed to Fetch URL'));

            xhr.onabort = () => rej(new Error('aborted'));
        }),

        cancel: () => xhr.abort()
    };
}

/**
 * @private
 *
 * Takes (presumably) a `ArrayBuffer`-encoded image and returns it represented as either the `ImageBitmap` or
 * `HTMLImageElement` (in case `ImageBitmap`s are not supported by the target environment).
 *
 * Both the types are available to be used as an image source for canvases.
 *
 * @function
 * @param {ArrayBuffer} data `ArrayBuffer`-encoded image
 * @returns {Promise<ImageBitmap | HTMLImageElement>} A `Promise` that rejects with an `Error` in case it was impossible
 * to build the resulting image or resolves with the resulting image in case of success
 */
export async function arrayBufferToCanvasImageSource(data: ArrayBuffer, _testForceImageLoad?: boolean): Promise<ImageBitmap | HTMLImageElement> {
    const blob: Blob = new Blob([new Uint8Array(data)], {type: 'image/png'});

    if (typeof createImageBitmap === 'function') {
        // use `ImageBitmap` when it's supported

        try {
            return await createImageBitmap(blob);
        } catch (err) {
            throw new Error(`Could not load image because of ${err.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`);
        }
    } else {
        // otherwise, just a plain HTML image element

        const transparentPngUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';

        const img: HTMLImageElement = new Image();
        img.src = data.byteLength ? URL.createObjectURL(blob) : transparentPngUrl;

        return new Promise((res, rej) => {
            img.addEventListener('load', () => {
                URL.revokeObjectURL(img.src);
                window.requestAnimationFrame(() => { img.src = transparentPngUrl; });

                res(img);
            });

            img.addEventListener('error', () => {
                rej(new Error('Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.'));
            });

            // for testing purposes only!
            if (_testForceImageLoad === true) {
                img.dispatchEvent(new Event('load'));
            } else if (_testForceImageLoad === false) {
                img.dispatchEvent(new Event('error'));
            }
        });
    }
}

export const helper = {getArrayBuffer, makeRequest, makeFetchRequest, makeXMLHttpRequest};

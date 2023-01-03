import {extend, isWorker, arrayBufferToImageBitmap, arrayBufferToImage} from './util';
import config from './config';
import webpSupported from './webp_supported';

import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

export interface IResourceType {
    Unknown: keyof this;
    Style: keyof this;
    Source: keyof this;
    Tile: keyof this;
    Glyphs: keyof this;
    SpriteImage: keyof this;
    SpriteJSON: keyof this;
    Image: keyof this;
}

/**
 * The type of a resource.
 * @private
 * @readonly
 * @enum {string}
 */
const ResourceType = {
    Unknown: 'Unknown',
    Style: 'Style',
    Source: 'Source',
    Tile: 'Tile',
    Glyphs: 'Glyphs',
    SpriteImage: 'SpriteImage',
    SpriteJSON: 'SpriteJSON',
    Image: 'Image'
} as IResourceType;
export {ResourceType};

if (typeof Object.freeze == 'function') {
    Object.freeze(ResourceType);
}

/**
 * A `RequestParameters` object to be returned from Map.options.transformRequest callbacks.
 * @typedef {Object} RequestParameters
 * @property {string} url The URL to be requested.
 * @property {Object} headers The headers to be sent with the request.
 * @property {string} method Request method `'GET' | 'POST' | 'PUT'`.
 * @property {string} body Request body.
 * @property {string} type Response body type to be returned `'string' | 'json' | 'arrayBuffer'`.
 * @property {string} credentials `'same-origin'|'include'` Use 'include' to send cookies with cross-origin requests.
 * @property {boolean} collectResourceTiming If true, Resource Timing API information will be collected for these transformed requests and returned in a resourceTiming property of relevant data events.
 * @example
 * // use transformRequest to modify requests that begin with `http://myHost`
 * transformRequest: function(url, resourceType) {
 *  if (resourceType === 'Source' && url.indexOf('http://myHost') > -1) {
 *    return {
 *      url: url.replace('http', 'https'),
 *      headers: { 'my-custom-header': true },
 *      credentials: 'include'  // Include cookies for cross-origin requests
 *    }
 *   }
 *  }
 *
 */
export type RequestParameters = {
    url: string;
    headers?: any;
    method?: 'GET' | 'POST' | 'PUT';
    body?: string;
    type?: 'string' | 'json' | 'arrayBuffer';
    credentials?: 'same-origin' | 'include';
    collectResourceTiming?: boolean;
};

export type ResponseCallback<T> = (
    error?: Error | null,
    data?: T | null,
    cacheControl?: string | null,
    expires?: string | null
) => void;

/**
 * An error thrown when a HTTP request results in an error response.
 * @extends Error
 * @param {number} status The response's HTTP status code.
 * @param {string} statusText The response's HTTP status text.
 * @param {string} url The request's URL.
 * @param {Blob} body The response's body.
 */
export class AJAXError extends Error {
    /**
     * The response's HTTP status code.
     */
    status: number;

    /**
     * The response's HTTP status text.
     */
    statusText: string;

    /**
     * The request's URL.
     */
    url: string;

    /**
     * The response's body.
     */
    body: Blob;

    constructor(status: number, statusText: string, url: string, body: Blob) {
        super(`AJAXError: ${statusText} (${status}): ${url}`);
        this.status = status;
        this.statusText = statusText;
        this.url = url;
        this.body = body;
    }
}

// Ensure that we're sending the correct referrer from blob URL worker bundles.
// For files loaded from the local file system, `location.origin` will be set
// to the string(!) "null" (Firefox), or "file://" (Chrome, Safari, Edge, IE),
// and we will set an empty referrer. Otherwise, we're using the document's URL.
/* global self */
export const getReferrer = isWorker() ?
    () => (self as any).worker && (self as any).worker.referrer :
    () => (window.location.protocol === 'blob:' ? window.parent : window).location.href;

// Determines whether a URL is a file:// URL. This is obviously the case if it begins
// with file://. Relative URLs are also file:// URLs iff the original document was loaded
// via a file:// URL.
const isFileURL = url => /^file:/.test(url) || (/^file:/.test(getReferrer()) && !/^\w+:/.test(url));

export type MapLibreRequestParameters = RequestInit & { url: string };
export enum MapLibreRequestDataType {
    'string' = 'string',
    'json' = 'json',
    'arrayBuffer' = 'arrayBuffer'
}
export type MapLibreRequest<T> = {response: Promise<T>} & Cancelable;
export type MapLibreResponse<T> = {
    data: T;
    cacheControl?: string;
    expires?: string;
}

function makeFetchRequest<T>(requestParameters: MapLibreRequestParameters, requestDataType?: MapLibreRequestDataType): MapLibreRequest<MapLibreResponse<T>> {
    const abortController = new AbortController();

    const request = new Request(requestParameters.url, extend({}, requestParameters, {
        referrer: getReferrer(),
        signal: abortController.signal
    }));

    if (requestDataType === 'json') {
        request.headers.set('Accept', 'application/json');
    }

    return {
        response: (async (): Promise<MapLibreResponse<T>> => {
            try {
                const response = await fetch(request);

                if (response.ok) {
                    const data: T = await (requestDataType === 'arrayBuffer' ? response.arrayBuffer() : requestDataType === 'json' ? response.json() : response.text());

                    return {
                        data,
                        cacheControl: response.headers.get('Cache-Control'),
                        expires: response.headers.get('Expires')
                    };

                } else {
                    throw new AJAXError(response.status, response.statusText, requestParameters.url, await response.blob());
                }
            } catch (err) {
                if (err.code === 20) return;

                if (err instanceof AJAXError) {
                    throw err;
                } else {
                    throw new Error(err.message);
                }
            }
        })(),

        cancel: () => abortController.abort()
    };
}

function makeXMLHttpRequest<T>(requestParameters: MapLibreRequestParameters, requestDataType?: MapLibreRequestDataType): MapLibreRequest<MapLibreResponse<T>> {
    const xhr: XMLHttpRequest = new XMLHttpRequest();
    xhr.open(requestParameters.method || 'GET', requestParameters.url, true);

    if (requestDataType === 'arrayBuffer') {
        xhr.responseType = 'arraybuffer';
    }

    for (const k in requestParameters.headers) {
        xhr.setRequestHeader(k, requestParameters.headers[k]);
    }

    if (requestDataType === 'json') {
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

                    if (requestDataType === 'json') {
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
                    const body = new Blob([xhr.response], {type: xhr.getResponseHeader('Content-Type')});
                    rej(new AJAXError(xhr.status, xhr.statusText, requestParameters.url, body));
                }
            };

            xhr.onerror = rej;
        }),

        cancel: () => xhr.abort()
    };
}

export function makeRequest <T>(requestParameters: MapLibreRequestParameters, requestDataType?: MapLibreRequestDataType): MapLibreRequest<MapLibreResponse<T>> {
    // We're trying to use the Fetch API if possible. However, in some situations we can't use it:
    // - IE11 doesn't support it at all. In this case, we dispatch the request to the main thread so
    //   that we can get an accruate referrer header.
    // - Safari exposes window.AbortController, but it doesn't work actually abort any requests in
    //   some versions (see https://bugs.webkit.org/show_bug.cgi?id=174980#c2)
    // - Requests for resources with the file:// URI scheme don't work with the Fetch API either. In
    //   this case we unconditionally use XHR on the current thread since referrers don't matter.

    // if the url does not start with `http[s]:` or `file:`
    if (/:\/\//.test(requestParameters.url) && !(/^https?:|^file:/.test(requestParameters.url))) {
        // and if the request made from inside a worker
        if (isWorker() && (self as any).worker && (self as any).worker.actor) {
            // ask the main thread to make the request from there
            return (self as any).worker.actor.send('getResource', requestParameters, requestDataType);
        }

        // if it's not a worker
        if (!isWorker()) {
            // check the protocol, and if there exists a custom handler for the protocol, then execute the custom
            // handler. Otherwise, make a fetch request
            const protocol = requestParameters.url.substring(0, requestParameters.url.indexOf('://'));
            const action = config.REGISTERED_PROTOCOLS[protocol] || makeFetchRequest;
            return action(requestParameters, requestDataType);
        }
    }

    // if the protocol is not `file://`
    if (!isFileURL(requestParameters.url)) {
        // and if Fetch API is supported by the target environment
        if (fetch && Request && AbortController && Object.prototype.hasOwnProperty.call(Request.prototype, 'signal')) {
            // then make a fetch request
            return makeFetchRequest(requestParameters, requestDataType);
        }

        // if the function is called from a worker
        if (isWorker() && (self as any).worker && (self as any).worker.actor) {
            // ask the main thread to make the request
            return (self as any).worker.actor.send('getResource', requestParameters, requestDataType);
        }
    }

    // fallback to XMLHttpRequest
    return makeXMLHttpRequest(requestParameters, requestDataType);
}

function makeRequestTmpAdapter(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
    const request = makeRequest(requestParameters, MapLibreRequestDataType[requestParameters.type]);
    request.response.then(response => {
        callback(null, response.data, response.cacheControl, response.expires);
    }).catch(err => {
        callback(err);
    });
    return request;
}

export const getJSON = function(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
    return makeRequestTmpAdapter(extend(requestParameters, {type: 'json'}), callback);
};

export function getJSONNew<T = Record<string, unknown> | unknown[]>(requestParameters: RequestParameters): MapLibreRequest<MapLibreResponse<T>> {
    return makeRequest<T>(requestParameters, MapLibreRequestDataType.json);
}

export const getArrayBuffer = function(
    requestParameters: RequestParameters,
    callback: ResponseCallback<ArrayBuffer>
): Cancelable {
    return makeRequestTmpAdapter(extend(requestParameters, {type: 'arrayBuffer'}), callback);
};

export const postData = function(requestParameters: RequestParameters, callback: ResponseCallback<string>): Cancelable {
    return makeRequestTmpAdapter(extend(requestParameters, {method: 'POST'}), callback);
};

function sameOrigin(url) {
    const a: HTMLAnchorElement = window.document.createElement('a');
    a.href = url;
    return a.protocol === window.document.location.protocol && a.host === window.document.location.host;
}

export type ExpiryData = {cacheControl?: string | null; expires?: Date | string | null};

function arrayBufferToCanvasImageSource(data: ArrayBuffer, callback: Callback<CanvasImageSource>) {
    const imageBitmapSupported = typeof createImageBitmap === 'function';
    if (imageBitmapSupported) {
        arrayBufferToImageBitmap(data, callback);
    } else {
        arrayBufferToImage(data, callback);
    }
}

let imageQueue, numImageRequests;
export const resetImageRequestQueue = () => {
    imageQueue = [];
    numImageRequests = 0;
};
resetImageRequestQueue();

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

    // limit concurrent image loads to help with raster sources performance on big screens
    if (numImageRequests >= config.MAX_PARALLEL_IMAGE_REQUESTS) {
        const queued = {
            requestParameters,
            callback,
            cancelled: false,
            cancel() { this.cancelled = true; }
        };
        imageQueue.push(queued);
        return queued;
    }
    numImageRequests++;

    let advanced = false;
    const advanceImageRequestQueue = () => {
        if (advanced) return;
        advanced = true;
        numImageRequests--;

        while (imageQueue.length && numImageRequests < config.MAX_PARALLEL_IMAGE_REQUESTS) { // eslint-disable-line
            const request = imageQueue.shift();
            const {requestParameters, callback, cancelled} = request;
            if (!cancelled) {
                request.cancel = getImage(requestParameters, callback).cancel;
            }
        }
    };

    // request the image with XHR to work around caching issues
    // see https://github.com/mapbox/mapbox-gl-js/issues/1470
    const request = getArrayBuffer(requestParameters, (err?: Error | null, data?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {

        advanceImageRequestQueue();

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
    });

    return {
        cancel: () => {
            request.cancel();
            advanceImageRequestQueue();
        }
    };
};

export const getVideo = function(urls: Array<string>, callback: Callback<HTMLVideoElement>): Cancelable {
    const video: HTMLVideoElement = window.document.createElement('video');
    video.muted = true;
    video.onloadstart = function() {
        callback(null, video);
    };
    for (let i = 0; i < urls.length; i++) {
        const s: HTMLSourceElement = window.document.createElement('source');
        if (!sameOrigin(urls[i])) {
            video.crossOrigin = 'Anonymous';
        }
        s.src = urls[i];
        video.appendChild(s);
    }
    return {cancel: () => {}};
};

import {extend, isWorker} from './util';
import {config} from './config';

import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

/**
 * A type used to store the tile's expiration date and cache control definition
 */
export type ExpiryData = {cacheControl?: string | null; expires?: Date | string | null};

/**
 * A `RequestParameters` object to be returned from Map.options.transformRequest callbacks.
 * @example
 * ```ts
 * // use transformRequest to modify requests that begin with `http://myHost`
 * transformRequest: function(url, resourceType) {
 *  if (resourceType === 'Source' && url.indexOf('http://myHost') > -1) {
 *    return {
 *      url: url.replace('http', 'https'),
 *      headers: { 'my-custom-header': true },
 *      credentials: 'include'  // Include cookies for cross-origin requests
 *    }
 *   }
 * }
 * ```
 */
export type RequestParameters = {
    /**
     * The URL to be requested.
     */
    url: string;
    /**
     * The headers to be sent with the request.
     */
    headers?: any;
    /**
     * Request method `'GET' | 'POST' | 'PUT'`.
     */
    method?: 'GET' | 'POST' | 'PUT';
    /**
     * Request body.
     */
    body?: string;
    /**
     * Response body type to be returned `'string' | 'json' | 'arrayBuffer'`.
     */
    type?: 'string' | 'json' | 'arrayBuffer' | 'image';
    /**
     * `'same-origin'|'include'` Use 'include' to send cookies with cross-origin requests.
     */
    credentials?: 'same-origin' | 'include';
    /**
     * If `true`, Resource Timing API information will be collected for these transformed requests and returned in a resourceTiming property of relevant data events.
     */
    collectResourceTiming?: boolean;
    /**
     * Parameters supported only by browser fetch API. Property of the Request interface contains the cache mode of the request. It controls how the request will interact with the browser's HTTP cache. (https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
     */
    cache?: RequestCache;
};

export type GetResourceResponse<T> = ExpiryData & {
    data: T;
}

/**
 * The response callback used in various places
 */
export type ResponseCallback<T> = (
    error?: Error | null,
    data?: T | null,
    cacheControl?: string | null,
    expires?: string | null
) => void;

/**
 * An error thrown when a HTTP request results in an error response.
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

    /**
     * @param status - The response's HTTP status code.
     * @param statusText - The response's HTTP status text.
     * @param url - The request's URL.
     * @param body - The response's body.
     */
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
export const getReferrer = () => isWorker(self) ?
    self.worker && self.worker.referrer :
    (window.location.protocol === 'blob:' ? window.parent : window).location.href;

export const getProtocolAction = url => config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))];

// Determines whether a URL is a file:// URL. This is obviously the case if it begins
// with file://. Relative URLs are also file:// URLs iff the original document was loaded
// via a file:// URL.
const isFileURL = url => /^file:/.test(url) || (/^file:/.test(getReferrer()) && !/^\w+:/.test(url));

async function makeFetchRequest(requestParameters: RequestParameters, abortController: AbortController): Promise<GetResourceResponse<any> | undefined> {
    const request = new Request(requestParameters.url, {
        method: requestParameters.method || 'GET',
        body: requestParameters.body,
        credentials: requestParameters.credentials,
        headers: requestParameters.headers,
        cache: requestParameters.cache,
        referrer: getReferrer(),
        signal: abortController.signal
    });

    if (requestParameters.type === 'json') {
        request.headers.set('Accept', 'application/json');
    }
    if (abortController.signal.aborted) {
        throw new Error('AbortError');
    }

    try {
        const response = await fetch(request);
        if (!response.ok) {
            const body = await response.blob();
            throw new AJAXError(response.status, response.statusText, requestParameters.url, body);
        }
        const parsePromise = (requestParameters.type === 'arrayBuffer' || requestParameters.type === 'image') ? response.arrayBuffer() :
            requestParameters.type === 'json' ? response.json() :
                response.text();
        const result = await parsePromise;
        return {data: result, cacheControl: response.headers.get('Cache-Control'), expires: response.headers.get('Expires')};
    } catch (error) {
        if (abortController.signal.aborted) {
            throw new Error('AbortError');
        }
        throw new Error(error.message);
    }
}

function makeXMLHttpRequest(requestParameters: RequestParameters, abortController): Promise<GetResourceResponse<any>> {
    return new Promise((resolve, reject) => {
        const xhr: XMLHttpRequest = new XMLHttpRequest();

        xhr.open(requestParameters.method || 'GET', requestParameters.url, true);
        if (requestParameters.type === 'arrayBuffer' || requestParameters.type === 'image') {
            xhr.responseType = 'arraybuffer';
        }
        for (const k in requestParameters.headers) {
            xhr.setRequestHeader(k, requestParameters.headers[k]);
        }
        if (requestParameters.type === 'json') {
            xhr.responseType = 'text';
            xhr.setRequestHeader('Accept', 'application/json');
        }
        xhr.withCredentials = requestParameters.credentials === 'include';
        xhr.onerror = () => {
            reject(new Error(xhr.statusText));
        };
        xhr.onload = () => {
            if (((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) && xhr.response !== null) {
                let data: unknown = xhr.response;
                if (requestParameters.type === 'json') {
                    // We're manually parsing JSON here to get better error messages.
                    try {
                        data = JSON.parse(xhr.response);
                    } catch (err) {
                        reject(err);
                        return;
                    }
                }
                resolve({data, cacheControl: xhr.getResponseHeader('Cache-Control'), expires: xhr.getResponseHeader('Expires')});
            } else {
                const body = new Blob([xhr.response], {type: xhr.getResponseHeader('Content-Type')});
                reject(new AJAXError(xhr.status, xhr.statusText, requestParameters.url, body));
            }
        };
        abortController.signal.addEventListener('abort', () => {
            xhr.abort();
            reject(new Error('AbortError'));
        });
        xhr.send(requestParameters.body);
    });
}

export const makeRequest = (requestParameters: RequestParameters, abortController: AbortController): Promise<GetResourceResponse<any>> => {
    // We're trying to use the Fetch API if possible. However, in some situations we can't use it:
    // - IE11 doesn't support it at all. In this case, we dispatch the request to the main thread so
    //   that we can get an accruate referrer header.
    // - Safari exposes window.AbortController, but it doesn't work actually abort any requests in
    //   some versions (see https://bugs.webkit.org/show_bug.cgi?id=174980#c2)
    // - Requests for resources with the file:// URI scheme don't work with the Fetch API either. In
    //   this case we unconditionally use XHR on the current thread since referrers don't matter.
    if (/:\/\//.test(requestParameters.url) && !(/^https?:|^file:/.test(requestParameters.url))) {
        if (isWorker(self) && self.worker && self.worker.actor) {
            return self.worker.actor.sendAsync({type: 'getResource', data: requestParameters}, abortController);
        }
        if (!isWorker(self)) {
            const action = getProtocolAction(requestParameters.url);
            if (action) {
                return addProtocolActionToPromise(action, requestParameters, abortController);
            } else {
                return makeFetchRequest(requestParameters, abortController);
            }
        }
    }
    if (!isFileURL(requestParameters.url)) {
        if (fetch && Request && AbortController && Object.prototype.hasOwnProperty.call(Request.prototype, 'signal')) {
            return makeFetchRequest(requestParameters, abortController);
        }
        if (isWorker(self) && self.worker && self.worker.actor) {
            return self.worker.actor.sendAsync({type: 'getResource', data: requestParameters, mustQueue: true}, abortController);
        }
    }
    return makeXMLHttpRequest(requestParameters, abortController);
};

function addProtocolActionToPromise(action: (requestParameters: RequestParameters, callback: ResponseCallback<any>) => Cancelable,
    requestParameters: RequestParameters,
    abortController: AbortController): Promise<GetResourceResponse<any>> {
    return new Promise((resolve, reject) => {
        const cancelable = action(requestParameters, (err, data, cacheControl, expires) => {
            if (err) {
                reject(err);
            } else {
                resolve({data, cacheControl, expires});
            }
        });
        abortController.signal.addEventListener('abort', () => {
            cancelable.cancel();
            reject(new Error('AbortError'));
        });
    });
}

export const getJSON = <T>(requestParameters: RequestParameters, abortController: AbortController): Promise<GetResourceResponse<T>> => {
    return makeRequest(extend(requestParameters, {type: 'json'}), abortController);
};

export const getArrayBuffer = (requestParameters: RequestParameters, abortController: AbortController): Promise<{data: ArrayBuffer} & ExpiryData> => {
    return makeRequest(extend(requestParameters, {type: 'arrayBuffer'}), abortController);
};

export function sameOrigin(inComingUrl: string) {
    // URL class should be available everywhere
    // https://developer.mozilla.org/en-US/docs/Web/API/URL
    // In addtion, a relative URL "/foo" or "./foo" will throw exception in its ctor,
    // try-catch is expansive so just use a heuristic check to avoid it
    // also check data URL
    if (!inComingUrl ||
        inComingUrl.indexOf('://') <= 0 || // relative URL
        inComingUrl.indexOf('data:image/') === 0 || // data image URL
        inComingUrl.indexOf('blob:') === 0) { // blob
        return true;
    }
    const urlObj = new URL(inComingUrl);
    const locationObj = window.location;
    return urlObj.protocol === locationObj.protocol && urlObj.host === locationObj.host;
}

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

import {extend, warnOnce, isWorker} from './util';
import {config} from './config';

import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

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
export const getReferrer = isWorker() ?
    () => (self as any).worker && (self as any).worker.referrer :
    () => (window.location.protocol === 'blob:' ? window.parent : window).location.href;

export const getProtocolAction = url => config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))];

// Determines whether a URL is a file:// URL. This is obviously the case if it begins
// with file://. Relative URLs are also file:// URLs iff the original document was loaded
// via a file:// URL.
const isFileURL = url => /^file:/.test(url) || (/^file:/.test(getReferrer()) && !/^\w+:/.test(url));

function makeFetchRequest(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
    const controller = new AbortController();
    const request = new Request(requestParameters.url, {
        method: requestParameters.method || 'GET',
        body: requestParameters.body,
        credentials: requestParameters.credentials,
        headers: requestParameters.headers,
        cache: requestParameters.cache,
        referrer: getReferrer(),
        signal: controller.signal
    });
    let complete = false;
    let aborted = false;

    if (requestParameters.type === 'json') {
        request.headers.set('Accept', 'application/json');
    }

    const validateOrFetch = (err, cachedResponse?, responseIsFresh?) => {
        if (aborted) return;

        if (err) {
            // Do fetch in case of cache error.
            // HTTP pages in Edge trigger a security error that can be ignored.
            if (err.message !== 'SecurityError') {
                warnOnce(err);
            }
        }

        if (cachedResponse && responseIsFresh) {
            return finishRequest(cachedResponse);
        }

        if (cachedResponse) {
            // We can't do revalidation with 'If-None-Match' because then the
            // request doesn't have simple cors headers.
        }

        fetch(request).then(response => {
            if (response.ok) {
                return finishRequest(response);

            } else {
                return response.blob().then(body => callback(new AJAXError(response.status, response.statusText, requestParameters.url, body)));
            }
        }).catch(error => {
            if (error.code === 20) {
                // silence expected AbortError
                return;
            }
            callback(new Error(error.message));
        });
    };

    const finishRequest = (response) => {
        (
            (requestParameters.type === 'arrayBuffer' || requestParameters.type === 'image') ? response.arrayBuffer() :
                requestParameters.type === 'json' ? response.json() :
                    response.text()
        ).then(result => {
            if (aborted) return;
            complete = true;
            callback(null, result, response.headers.get('Cache-Control'), response.headers.get('Expires'));
        }).catch(err => {
            if (!aborted) callback(new Error(err.message));
        });
    };

    validateOrFetch(null, null);

    return {cancel: () => {
        aborted = true;
        if (!complete) controller.abort();
    }};
}

function makeXMLHttpRequest(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
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
        callback(new Error(xhr.statusText));
    };
    xhr.onload = () => {
        if (((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) && xhr.response !== null) {
            let data: unknown = xhr.response;
            if (requestParameters.type === 'json') {
                // We're manually parsing JSON here to get better error messages.
                try {
                    data = JSON.parse(xhr.response);
                } catch (err) {
                    return callback(err);
                }
            }
            callback(null, data, xhr.getResponseHeader('Cache-Control'), xhr.getResponseHeader('Expires'));
        } else {
            const body = new Blob([xhr.response], {type: xhr.getResponseHeader('Content-Type')});
            callback(new AJAXError(xhr.status, xhr.statusText, requestParameters.url, body));
        }
    };
    xhr.send(requestParameters.body);
    return {cancel: () => xhr.abort()};
}

export const makeRequest = function(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
    // We're trying to use the Fetch API if possible. However, in some situations we can't use it:
    // - IE11 doesn't support it at all. In this case, we dispatch the request to the main thread so
    //   that we can get an accruate referrer header.
    // - Safari exposes window.AbortController, but it doesn't work actually abort any requests in
    //   some versions (see https://bugs.webkit.org/show_bug.cgi?id=174980#c2)
    // - Requests for resources with the file:// URI scheme don't work with the Fetch API either. In
    //   this case we unconditionally use XHR on the current thread since referrers don't matter.
    if (/:\/\//.test(requestParameters.url) && !(/^https?:|^file:/.test(requestParameters.url))) {
        if (isWorker() && (self as any).worker && (self as any).worker.actor) {
            return (self as any).worker.actor.send('getResource', requestParameters, callback);
        }
        if (!isWorker()) {
            const action = getProtocolAction(requestParameters.url) || makeFetchRequest;
            return action(requestParameters, callback);
        }
    }
    if (!isFileURL(requestParameters.url)) {
        if (fetch && Request && AbortController && Object.prototype.hasOwnProperty.call(Request.prototype, 'signal')) {
            return makeFetchRequest(requestParameters, callback);
        }
        if (isWorker() && (self as any).worker && (self as any).worker.actor) {
            const queueOnMainThread = true;
            return (self as any).worker.actor.send('getResource', requestParameters, callback, undefined, queueOnMainThread);
        }
    }
    return makeXMLHttpRequest(requestParameters, callback);
};

export const getJSON = function(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
    return makeRequest(extend(requestParameters, {type: 'json'}), callback);
};

export const getArrayBuffer = function(
    requestParameters: RequestParameters,
    callback: ResponseCallback<ArrayBuffer>
): Cancelable {
    return makeRequest(extend(requestParameters, {type: 'arrayBuffer'}), callback);
};

export const postData = function(requestParameters: RequestParameters, callback: ResponseCallback<string>): Cancelable {
    return makeRequest(extend(requestParameters, {method: 'POST'}), callback);
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
/**
 * A type used to store the tile's expiration date and cache control definition
 */
export type ExpiryData = {cacheControl?: string | null; expires?: Date | string | null};
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

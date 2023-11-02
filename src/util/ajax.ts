import {extend, isWorker} from './util';
import {config} from './config';
import {createAbortError} from './abort_error';

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
    expires?: string | Date | null
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

/**
 * Ensure that we're sending the correct referrer from blob URL worker bundles.
 * For files loaded from the local file system, `location.origin` will be set
 * to the string(!) "null" (Firefox), or "file://" (Chrome, Safari, Edge),
 * and we will set an empty referrer. Otherwise, we're using the document's URL.
 */
export const getReferrer = () => isWorker(self) ?
    self.worker && self.worker.referrer :
    (window.location.protocol === 'blob:' ? window.parent : window).location.href;

export const getProtocolAction = url => config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))];

/**
 * Determines whether a URL is a file:// URL. This is obviously the case if it begins
 * with file://. Relative URLs are also file:// URLs iff the original document was loaded
 * via a file:// URL.
 * @param url - The URL to check
 * @returns `true` if the URL is a file:// URL, `false` otherwise
 */
const isFileURL = url => /^file:/.test(url) || (/^file:/.test(getReferrer()) && !/^\w+:/.test(url));

function makeFetchRequest(requestParameters: RequestParameters, abortController: AbortController): Promise<GetResourceResponse<any>> {
    return new Promise((resolve, reject) => {
        const request = new Request(requestParameters.url, {
            method: requestParameters.method || 'GET',
            body: requestParameters.body,
            credentials: requestParameters.credentials,
            headers: requestParameters.headers,
            cache: requestParameters.cache,
            referrer: getReferrer(),
            signal: abortController.signal
        });
        let aborted = false;

        if (requestParameters.type === 'json') {
            request.headers.set('Accept', 'application/json');
        }

        abortController.signal.addEventListener('abort', () => {
            aborted = true;
        });

        const validateOrFetch = async () => {
            if (aborted) return;

            try {
                const response = await fetch(request);
                if (!response.ok) {
                    return response.blob().then(body => reject(new AJAXError(response.status, response.statusText, requestParameters.url, body)));
                }
                const parsePromise = (requestParameters.type === 'arrayBuffer' || requestParameters.type === 'image') ? response.arrayBuffer() :
                    requestParameters.type === 'json' ? response.json() :
                        response.text();
                try {
                    const result = await parsePromise;
                    if (aborted) return;
                    resolve({data: result, cacheControl: response.headers.get('Cache-Control'), expires: response.headers.get('Expires')});
                } catch (err) {
                    if (!aborted) reject(new Error(err.message));
                }
            } catch (error) {
                if (error.code === 20) {
                    // silence expected AbortError
                    return;
                }
                reject(new Error(error.message));
            }
        };

        validateOrFetch();
    });
}

function makeXMLHttpRequest(requestParameters: RequestParameters, abortController: AbortController): Promise<GetResourceResponse<any>> {
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
            if (abortController.signal.aborted) {
                return;
            }
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
            reject(createAbortError());
        });
        xhr.send(requestParameters.body);
    });
}


/**
 * We're trying to use the Fetch API if possible. However, requests for resources with the file:// URI scheme don't work with the Fetch API. 
 * In this case we unconditionally use XHR on the current thread since referrers don't matter.
 * This method can also use the registered method if `addProtocol` was called.
 * @param requestParameters - The request parameters
 * @param abortController - The abort controller allowing to cancel the request
 * @returns a promise resolving to the response, including cache control and expiry data
 */
export const makeRequest = function(requestParameters: RequestParameters, abortController: AbortController): Promise<GetResourceResponse<any>> {
    if (/:\/\//.test(requestParameters.url) && !(/^https?:|^file:/.test(requestParameters.url))) {
        if (isWorker(self) && self.worker && self.worker.actor) {
            return self.worker.actor.sendAsync({type: 'getResource', data: requestParameters}, abortController);
        }
        if (!isWorker(self)) {
            const action = cancelableToPromise(getProtocolAction(requestParameters.url)) || makeFetchRequest;
            return action(requestParameters, abortController);
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

// HM TODO: remove this when changing how add protocol works?
function cancelableToPromise(method: (requestParameters: RequestParameters, callback: ResponseCallback<any>) => Cancelable): (requestParameters: RequestParameters, abortController: AbortController) => Promise<GetResourceResponse<any>> {
    return (requestParameters: RequestParameters, abortController: AbortController): Promise<GetResourceResponse<any>> => {
        return new Promise<GetResourceResponse<any>>((resolve, reject) => {
            const callback = (err: Error, data: any, cacheControl: string | null, expires: string | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({data, cacheControl, expires});
                }
            };
            const canelable = method(requestParameters, callback);
            abortController.signal.addEventListener('abort', () => {
                canelable.cancel();
                reject(createAbortError());
            });
        });
    };
}

export const getJSON = <T>(requestParameters: RequestParameters, abortController: AbortController): Promise<{data: T} & ExpiryData> => {
    return makeRequest(extend(requestParameters, {type: 'json'}), abortController);
};

export const getArrayBuffer = (requestParameters: RequestParameters, abortController: AbortController): Promise<{data: ArrayBuffer} & ExpiryData> => {
    return makeRequest(extend(requestParameters, {type: 'arrayBuffer'}), abortController);
};

export function sameOrigin(inComingUrl: string) {
    // A relative URL "/foo" or "./foo" will throw exception in URL's ctor,
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

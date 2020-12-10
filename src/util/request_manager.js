// @flow
import type {RequestParameters} from './ajax';

type ResourceTypeEnum = $Keys<typeof ResourceType>;
export type RequestTransformFunction = (url: string, resourceType?: ResourceTypeEnum) => RequestParameters;

type UrlObject = {|
    protocol: string,
    authority: string,
    path: string,
    params: Array<string>
|};

class RequestManager {
    _transformRequestFn: ?RequestTransformFunction;

    constructor(transformRequestFn?: RequestTransformFunction) {
        this._transformRequestFn = transformRequestFn;
    }

    transformRequest(url: string, type: ResourceTypeEnum) {
        if (this._transformRequestFn) {
            return this._transformRequestFn(url, type) || {url};
        }

        return {url};
    }

    normalizeSpriteURL(url: string, format: string, extension: string): string {
        const urlObject = parseUrl(url);
        urlObject.path += `${format}${extension}`;
        return formatUrl(urlObject);
    }
}

const urlRe = /^(\w+):\/\/([^/?]*)(\/[^?]+)?\??(.+)?/;

function parseUrl(url: string): UrlObject {
    const parts = url.match(urlRe);
    if (!parts) {
        throw new Error('Unable to parse URL object');
    }
    return {
        protocol: parts[1],
        authority: parts[2],
        path: parts[3] || '/',
        params: parts[4] ? parts[4].split('&') : []
    };
}

function formatUrl(obj: UrlObject): string {
    const params = obj.params.length ? `?${obj.params.join('&')}` : '';
    return `${obj.protocol}://${obj.authority}${obj.path}${params}`;
}

export default RequestManager;
import type {RequestParameters} from './ajax';

/**
 * A type of MapLibre resource.
 */
export const enum ResourceType {
    Glyphs = 'Glyphs',
    Image = 'Image',
    Source = 'Source',
    SpriteImage = 'SpriteImage',
    SpriteJSON = 'SpriteJSON',
    Style = 'Style',
    Tile = 'Tile',
    Unknown = 'Unknown',
}

/**
 * This function is used to tranform a request.
 * It is used just before executing the relevant request.
 */
export type RequestTransformFunction = (url: string, resourceType?: ResourceType) => RequestParameters | undefined;

type UrlObject = {
    protocol: string;
    authority: string;
    path: string;
    params: Array<string>;
};

export class RequestManager {
    _transformRequestFn: RequestTransformFunction;

    constructor(transformRequestFn?: RequestTransformFunction) {
        this._transformRequestFn = transformRequestFn;
    }

    transformRequest(url: string, type: ResourceType) {
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

    setTransformRequest(transformRequest: RequestTransformFunction) {
        this._transformRequestFn = transformRequest;
    }
}

const urlRe = /^(\w+):\/\/([^/?]*)(\/[^?]+)?\??(.+)?/;

function parseUrl(url: string): UrlObject {
    const parts = url.match(urlRe);
    if (!parts) {
        throw new Error(`Unable to parse URL "${url}"`);
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

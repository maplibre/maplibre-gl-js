import type {RequestParameters} from './ajax.ts';

/**
 * A type of MapLibre resource.
 *
 * The values are title-cased because they are the strings MapLibre passes to
 * `transformRequest`, so they are part of that callback's public contract.
 */
export type ResourceType =
    | 'Glyphs'
    | 'Image'
    | 'Source'
    | 'SpriteImage'
    | 'SpriteJSON'
    | 'Style'
    | 'Tile'
    | 'Unknown';

/**
 * This function is used to transform a request.
 * It is used just before executing the relevant request.
 */
export type RequestTransformFunction = (url: string, resourceType?: ResourceType) => RequestParameters | Promise<RequestParameters> | undefined;

export class RequestManager {
    _transformRequestFn: RequestTransformFunction | null;

    constructor(transformRequestFn?: RequestTransformFunction | null) {
        this._transformRequestFn = transformRequestFn ?? null;
    }

    transformRequest(url: string, type: ResourceType): RequestParameters | Promise<RequestParameters> {
        if (this._transformRequestFn) {
            return this._transformRequestFn(url, type) || {url};
        }

        return {url};
    }

    setTransformRequest(transformRequest: RequestTransformFunction | null): void {
        this._transformRequestFn = transformRequest;
    }

    getTransformRequest(): RequestTransformFunction | null {
        return this._transformRequestFn;
    }
}


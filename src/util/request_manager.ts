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

export class RequestManager {
    _transformRequestFn: RequestTransformFunction | null;

    constructor(transformRequestFn?: RequestTransformFunction | null) {
        this._transformRequestFn = transformRequestFn ?? null;
    }

    transformRequest(url: string, type: ResourceType) {
        if (this._transformRequestFn) {
            return this._transformRequestFn(url, type) || {url};
        }

        return {url};
    }

    setTransformRequest(transformRequest: RequestTransformFunction | null) {
        this._transformRequestFn = transformRequest;
    }
}


import type {RequestParameters, GetResourceResponse} from './ajax.ts';

/**
 * The `data` a protocol handler resolves with. Which member is expected follows `RequestParameters.type`:
 *
 * - `'arrayBuffer'`: an `ArrayBuffer`, for example a non-compressed pbf vector tile.
 * - `'json'`: the parsed JSON value.
 * - `'string'`: a string.
 * - `'image'`: an `ImageBitmap` or `HTMLImageElement`, used as is, or an `ArrayBuffer` of encoded image
 *   bytes, which are decoded first. A handler that already holds decoded pixels should return them as an
 *   `ImageBitmap`, since encoding them only makes the library decode them again.
 */
export type AddProtocolResponseData = ArrayBuffer | ImageBitmap | HTMLImageElement | string | object;

/**
 * This method type is used to register a protocol handler.
 * Use the abort controller for aborting requests.
 * Return a promise with the relevant resource response, see {@link AddProtocolResponseData} for what `data` may hold.
 */
export type AddProtocolAction = (requestParameters: RequestParameters, abortController: AbortController) => Promise<GetResourceResponse<AddProtocolResponseData>>;

/**
 * This is a global config object used to store the configuration
 * It is available in the workers as well.
 * Only serializable data should be stored in it.
 */
type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: number;
    MAX_TILE_CACHE_ZOOM_LEVELS: number;
    REGISTERED_PROTOCOLS: {[x: string]: AddProtocolAction };
    WORKER_URL: string;
};

export const config: Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: 8,
    MAX_TILE_CACHE_ZOOM_LEVELS: 5,
    REGISTERED_PROTOCOLS: {},
    WORKER_URL: ''
};

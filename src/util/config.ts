import type {Cancelable} from '../types/cancelable';
import type {RequestParameters, ResponseCallback} from './ajax';

/**
 * This is a global config object used to store the configuration
 * It is available in the workers as well.
 * Only serializable data should be stored in it.
 */
type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: number;
    MAX_TILE_CACHE_ZOOM_LEVELS: number;
    REGISTERED_PROTOCOLS: {[x: string]: (requestParameters: RequestParameters, callback: ResponseCallback<any>) => Cancelable};
    WORKER_URL: string;
};

export const config: Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: 8,
    MAX_TILE_CACHE_ZOOM_LEVELS: 5,
    REGISTERED_PROTOCOLS: {},
    WORKER_URL: ''
};

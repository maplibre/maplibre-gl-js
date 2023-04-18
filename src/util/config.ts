import type {Cancelable} from '../types/cancelable';
import type {RequestParameters, ResponseCallback} from './ajax';

type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: number;
    REGISTERED_PROTOCOLS: {[x: string]: (requestParameters: RequestParameters, callback: ResponseCallback<any>) => Cancelable};
    WORKER_URL: string;
};

const config: Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: 8,
    REGISTERED_PROTOCOLS: {},
    WORKER_URL: ''
};

export default config;

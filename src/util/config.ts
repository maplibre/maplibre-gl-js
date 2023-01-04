import {MapLibreRequest, MapLibreRequestDataType, MapLibreRequestParameters, MapLibreResponse} from './ajax';

type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    REGISTERED_PROTOCOLS: {[P: string]: <T = unknown>(requestParameters: MapLibreRequestParameters, requestDataType: MapLibreRequestDataType) => MapLibreRequest<MapLibreResponse<T>>};
};

const config: Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    REGISTERED_PROTOCOLS: {},
};

export default config;

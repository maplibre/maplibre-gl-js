type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    /** max parallel image requests per frame */
    MAX_PARALLEL_IMAGE_REQUESTS_FRAME: number;
    REGISTERED_PROTOCOLS: {[x: string]: any};
};

const config: Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    MAX_PARALLEL_IMAGE_REQUESTS_FRAME: 8,
    REGISTERED_PROTOCOLS: {},
};

export default config;

type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    MAX_PARALLEL_IMAGE_REQUESTS_WHILE_THROTTLED: number;
    REGISTERED_PROTOCOLS: {[x: string]: any};
};

const config: Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    MAX_PARALLEL_IMAGE_REQUESTS_WHILE_THROTTLED: 8,
    REGISTERED_PROTOCOLS: {},
};

export default config;

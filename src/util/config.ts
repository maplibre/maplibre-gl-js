type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    REGISTERED_PROTOCOLS: {[x: string]: any};
};

const config: Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    REGISTERED_PROTOCOLS: {},
};

export default config;

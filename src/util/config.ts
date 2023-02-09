type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: number;
    REGISTERED_PROTOCOLS: {[x: string]: any};
    ENABLE_RASTER_MIPMAPS: boolean;
};

const config: Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: 8,
    REGISTERED_PROTOCOLS: {},
    ENABLE_RASTER_MIPMAPS: true,
};

export default config;

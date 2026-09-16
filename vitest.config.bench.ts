import {defineConfig, type ViteUserConfig} from 'vitest/config';

const config: ViteUserConfig = defineConfig({
    test: {
        name: 'bench',
        environment: 'node',
        benchmark: {
            include: ['src/**/*.bench.ts'],
        },
    }
});

export default config;

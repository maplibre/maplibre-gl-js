import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        name: 'bench',
        environment: 'jsdom',
        environmentOptions: {
            jsdom: {
                url: 'http://localhost/',
            }
        },
        setupFiles: [
            'vitest-webgl-canvas-mock',
            './test/unit/lib/web_worker_mock.ts'
        ],
        testTimeout: 120_000,
        benchmark: {
            include: ['test/bench/benchmarks/**/*.bench.ts'],
            exclude: ['node_modules', 'dist'],
            reporters: ['default'],
        },
    },
});

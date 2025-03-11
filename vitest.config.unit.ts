import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        name: 'unit',
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
        include: [
            'src/**/*.test.{ts,js}'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['json', 'html'],
            exclude: ['node_modules/', 'dist/', '**/*.test.ts'],
            all: true,
            include: ['src'],
            reportsDirectory: './coverage/vitest/unit',
        },
    },
});

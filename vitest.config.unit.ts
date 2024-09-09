import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        name: 'unit',
        environment: 'jsdom',
        setupFiles: [
            'vitest-webgl-canvas-mock',
            './test/unit/lib/web_worker_mock.ts'
        ],
        include: [
            'src/**/*.test.{ts,js}'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/'],
            all: true,
            include: ['src'],
            reportsDirectory: './coverage/vitest/unit',
        },
    },
});

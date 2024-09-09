import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        name: 'integration',
        environment: 'node',
        include: [
            'test/integration/**/*.test.{ts,js}',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/'],
            all: true,
            include: ['src'],
            reportsDirectory: './coverage/vitest/integration',
        },
    },
});

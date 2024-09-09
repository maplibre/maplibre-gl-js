import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        name: 'build',
        environment: 'node',
        include: [
            'test/build/**/*.test.{ts,js}',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/'],
            all: true,
            include: ['src'],
            reportsDirectory: './coverage/vitest/build',
        },
    }
});

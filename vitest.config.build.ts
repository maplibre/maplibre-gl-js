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
            reporter: ['json', 'html'],
            exclude: ['**/*.test.ts'],
            include: ['src/**/*.{ts,js}'],
            reportsDirectory: './coverage/vitest/build',
        },
    }
});

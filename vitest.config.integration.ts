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
            reporter: ['json', 'html'],
            exclude: ['**/*.test.ts'],
            include: ['src/**/*.{ts,js}'],
            reportsDirectory: './coverage/vitest/integration',
        },
    },
});

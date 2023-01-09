import {Config} from 'jest';

const sharedConfig = {
    transform: {
        '[.](m|)(ts|js)x?$': ['ts-jest', {
            'isolatedModules': true,
        }],
    },
    transformIgnorePatterns: []
} as Partial<Config>;

const config: Config = {
    projects: [
        {
            displayName: 'e2e',
            testMatch: [
                '<rootDir>/test/integration/query/query.test.ts',
            ],
            preset: 'jest-playwright-preset',
            ...sharedConfig,
        },
        {
            displayName: 'jsdom',
            testMatch: [
                '<rootDir>/src/**/*.test.{ts,mts,js}',
                '<rootDir>/test/integration/expression/expression.test.ts',
                '<rootDir>/test/integration/symbol-shaping/shaping.test.ts',
            ],
            testEnvironment: 'jsdom',
            setupFiles: [
                'jest-canvas-mock',
                './test/unit/lib/web_worker_mock.ts'
            ],
            ...sharedConfig,
        },
        {
            displayName: 'bare',
            testEnvironment: 'node',
            testMatch: [
                '<rootDir>/test/integration/browser/browser.test.ts',
                '<rootDir>/test/integration/style-spec/validate_spec.test.ts',
                '<rootDir>/test/build/**/*.test.{ts,mts,js}',
            ],
            setupFiles: [],
            ...sharedConfig,
        }
    ]

};

export default config;

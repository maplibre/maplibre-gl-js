import {JestConfigWithTsJest} from 'ts-jest';

const sharedConfig = {
    transform: {
        '.*[.](ts|js)$': ['ts-jest', {
            'isolatedModules': true,
        }],
    },
    transformIgnorePatterns: []
} as any;

const config: JestConfigWithTsJest = {
    projects: [
        {
            displayName: 'e2e',
            testMatch: [
                '<rootDir>/test/integration/browser/**/*.test.{ts,mts,js}',
                '<rootDir>/test/integration/query/**/*.test.{ts,mts,js}',
            ],
            setupFiles: ['jest-canvas-mock'],
            ...sharedConfig,
        },
        {
            displayName: 'jsdom',
            testMatch: [
                '<rootDir>/test/integration/**/*.test.{ts,mts,js}',
                '<rootDir>/test/integration/**/*.test.{ts,mts,js}',
                '<rootDir>/src/**/*.test.{ts,mts,js}',
            ],
            testEnvironment: 'jsdom',
            setupFiles: [
                'jest-canvas-mock',
                './test/unit/lib/web_worker_mock.ts'
            ],
            ...sharedConfig,
        },
        {
            displayName: 'isolation',
            testMatch: [
                '<rootDir>/test/build/**/*.test.{ts,mts,js}',
            ],
            setupFiles: ['jest-canvas-mock'],
            ...sharedConfig,
        }
    ]

};

export default config;

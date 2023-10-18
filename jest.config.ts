import type {Config} from 'jest';

const sharedConfig = {
    transform: {
        // use typescript to convert from esm to cjs
        '[.](m|c)?(ts|js)(x)?$': ['ts-jest', {
            'isolatedModules': true,
            'tsconfig': 'tsconfig.jest.json'
        }],
    },
    // any tests that operate on dist files shouldn't compile them again.
    transformIgnorePatterns: ['<rootDir>/dist'],
    modulePathIgnorePatterns: ['<rootDir>/dist']
} as Partial<Config>;

const config: Config = {
    projects: [
        {
            displayName: 'unit',
            testEnvironment: 'jsdom',
            setupFiles: [
                'jest-canvas-mock',
                './test/unit/lib/web_worker_mock.ts'
            ],
            testMatch: [
                '<rootDir>/src/**/*.test.{ts,js}'
            ],
            ...sharedConfig
        },
        {
            displayName: 'integration',
            testEnvironment: 'node',
            testMatch: [
                '<rootDir>/test/integration/**/*.test.{ts,js}',
            ],
            ...sharedConfig,
        },
        {
            displayName: 'build',
            testEnvironment: 'node',
            testMatch: [
                '<rootDir>/test/build/**/*.test.{ts,js}',
            ],
            ...sharedConfig,
        },
    ]
};

export default config;

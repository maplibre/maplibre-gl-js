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
    coverageProvider: 'v8',
    reporters: [
        'github-actions',
        'jest-junit',
        ['jest-monocart-coverage', {
            name: 'MapLibre Unit Coverage Report',

            reports: [
                ['codecov']
            ],

            sourceFilter: (sourcePath) => {
                return !sourcePath.includes('node_modules/') && sourcePath.search(/src\//) !== -1;
            },

            outputDir: './coverage/jest'
        }]
    ],
    projects: [
        {
            displayName: 'unit',
            testEnvironment: 'jsdom',
            setupFiles: [
                'jest-webgl-canvas-mock',
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

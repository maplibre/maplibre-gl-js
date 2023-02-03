import type {JestConfigWithTsJest} from 'ts-jest';

const config: JestConfigWithTsJest = {
    roots: [
        '<rootDir>/src',
        '<rootDir>/test',
    ],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/?(*.)+(spec|test).+(ts|tsx|js)'
    ],
    testEnvironment: 'jsdom',
    transform: {
        '[.](js|ts)x?$': ['ts-jest', {
            isolatedModules: true
        }],
    },
    transformIgnorePatterns: [],
    setupFiles: [
        'jest-canvas-mock',
        './test/unit/lib/web_worker_mock.ts',
        './test/unit/lib/ajax_mock.ts'
    ],
};

export default config;

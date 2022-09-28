import type {InitialOptionsTsJest} from 'ts-jest';

const config: InitialOptionsTsJest = {
    roots: [
        '<rootDir>/src',
        '<rootDir>/test',
    ],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/?(*.)+(spec|test).+(ts|tsx|js)'
    ],
    testEnvironment: 'jsdom',
    preset: 'ts-jest/presets/js-with-ts-esm',
    transformIgnorePatterns: [
        '/node_modules/@mapbox/jsonlint-lines-primitives/lib/jsonlint.js'
    ],
    globals: {
        'ts-jest': {
            isolatedModules: true
        }
    },
    setupFiles: [
        'jest-canvas-mock',
        './test/unit/lib/web_worker_mock.ts'
    ],
};

export default config;

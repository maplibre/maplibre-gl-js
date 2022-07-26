import type {InitialOptionsTsJest} from 'ts-jest';
import {defaults as tsjPreset} from 'ts-jest/presets';

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
    transform: {
        ...tsjPreset.transform,
    },
    transformIgnorePatterns: [
        '/node_modules/@mapbox/jsonlint-lines-primitives/lib/jsonlint.js'
    ],
    setupFiles: [
        'jest-canvas-mock',
        './test/unit/lib/web_worker_mock.ts'
    ],
};

export default config;

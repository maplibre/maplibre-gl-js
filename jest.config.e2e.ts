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
    transform: {
        ...tsjPreset.transform,
    },
    transformIgnorePatterns: [
        '/node_modules/@mapbox/jsonlint-lines-primitives/lib/jsonlint.js'
    ],
    preset: 'jest-playwright-preset',

    globals: {
        'ts-jest': {
            isolatedModules: true
        }
    },
    setupFiles: ['jest-canvas-mock'],
};

export default config;

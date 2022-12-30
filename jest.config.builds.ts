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
    transform: {
        '[.](js|ts)x?$': ['ts-jest', {
            isolatedModules: true
        }],
    },
    transformIgnorePatterns: [],
    setupFiles: ['jest-canvas-mock'],
};

export default config;

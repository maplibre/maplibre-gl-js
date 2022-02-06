export default {
    'roots': [
        '<rootDir>/src',
        '<rootDir>/test',
    ],
    'testMatch': [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/?(*.)+(spec|test).+(ts|tsx|js)'
    ],
    'transform': {
        '^.+\\.(t|j)sx?$': '@swc/jest',
    },
    testEnvironment: 'jsdom',
    transformIgnorePatterns: [
        '/node_modules/@mapbox/jsonlint-lines-primitives/lib/jsonlint.js'
    ],
    setupFiles: ['jest-canvas-mock'],
};

module.exports = {
    'roots': [
        '<rootDir>/src',
        '<rootDir>/test/browser',
        '<rootDir>/test/build',
    ],
    'testMatch': [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/?(*.)+(spec|test).+(ts|tsx|js)'
    ],
    'transform': {
        '^.+\\.(t|j)sx?$': '@swc/jest',
        '^.+\\.(glsl)$': 'jest-raw-loader',
    },
    testEnvironment: 'jsdom',
    transformIgnorePatterns: [
        '/node_modules/@mapbox/jsonlint-lines-primitives/lib/jsonlint.js'
    ],
    setupFiles: ['jest-canvas-mock'],
};

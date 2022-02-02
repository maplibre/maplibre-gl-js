module.exports = {
  "roots": [
    "<rootDir>/src",
    "<rootDir>/test/browser",
    "<rootDir>/test/build",
  ],
  "testMatch": [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)"
  ],
  "transform": {
    "^.+\\.(ts|tsx)$": "ts-jest",
    "^.+\\.(js)$": "babel-jest",
  },
  testEnvironment: "jsdom",
  transformIgnorePatterns: [
    "/node_modules/@mapbox/jsonlint-lines-primitives/lib/jsonlint.js"
  ],
  setupFiles: ["jest-canvas-mock"],
}

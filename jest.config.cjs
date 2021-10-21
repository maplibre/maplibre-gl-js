module.exports = {
  "roots": [
    "<rootDir>/src"
  ],
  "testMatch": [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)"
  ],
  "transform": {
    "^.+\\.(ts|tsx)$": "ts-jest",
    "^.+\\.(js)$": "babel-jest",
    "^.+\\.(glsl)$": "jest-raw-loader",
  },
  testEnvironment: "jsdom",
  transformIgnorePatterns: [
  ],
  setupFiles: ["jest-canvas-mock"],
}

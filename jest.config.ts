/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  // A preset that is used as a base for Jest's configuration
  // preset: undefined,
  preset: "ts-jest",

  // The root directory that Jest should scan for tests and modules within
  rootDir: "src",

  // The test environment that will be used for testing
  // testEnvironment: "jest-environment-node",
  testEnvironment: "jsdom",

  // A map from regular expressions to paths to transformers
  // transform: undefined,
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
  }
};

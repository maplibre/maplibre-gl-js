# Tests

## Unit

### Tape

Unit tests in the `test` directory are written in [Tape](https://github.com/substack/tape) and are executed via `npm run test-unit`.

### Jest

New tests can be written for [Jest](https://jestjs.io/). We place the test files for Jest directly with the productive files. For example, the file `/maplibre-gl-js/src/geo/lng_lat.test.ts` contains the test of the file `/maplibre-gl-js/src/geo/lng_lat.ts`. The tests are executed via `npm run test-jest`. The output should look somethink like this:

```
$ npm run test-jest

> maplibre-gl@2.0.0-pre.3 test-jest
> jest

 PASS  src/geo/lng_lat.test.ts (9.727 s)
 PASS  src/geo/transform.test.ts
 PASS  src/geo/mercator_coordinate.test.ts

Test Suites: 3 passed, 3 total
Tests:       49 passed, 49 total
Snapshots:   0 total
Time:        15.98 s, estimated 20 s
Ran all test suites.
```

#### Configuration

Jest's configuration is defined through the file `jest.config.js`. 

##### preset

```ts
preset: "ts-jest"
```

A preset that is used as a base for typescript test. See https://github.com/kulshekhar/ts-jest.

##### rootDir

```ts
rootDir: "src"
```

We set `src` as root directory that Jest should scan for jest tests. This way we can store the files with the tests next to the source files. 

##### testEnvironment

```ts
testEnvironment: "jsdom"
```
The test environment that will be used for testing we use the recommended way to simulat a browser with jsdom, a lightweight browser implementation that runs inside Node.js. See https://github.com/jsdom/jsdom.

### transform

```ts
transform: {
'^.+\\.(ts|tsx)?$': 'ts-jest',
}
```

A map from regular expressions to paths to transformers. For typescript files we use `ts-jest`. 

## Integration

## Browser / User Interface Tests
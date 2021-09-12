# Tests

## Unit

### Tape

Unit tests in the `test` directory are written in [Tape](https://github.com/substack/tape) and run via `npm run test-unit`.

### Jest

New tests can be written for [Jest](https://jestjs.io/). We place the test files for Jest directly with the productive files. For example, the file `/maplibre-gl-js/src/geo/lng_lat.test.ts` contains the test of the file `/maplibre-gl-js/src/geo/lng_lat.ts`. The tests are executed via `npm run test-jest`. The output should look something like this:

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

The configuration of Jest is defined by the file `jest.config.js`. 

#### Migrate tests from Tape to Jest




#### 

## Integration

## Browser / User Interface Tests
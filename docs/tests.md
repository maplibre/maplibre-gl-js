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

1. The directory `test/unit_copy` contains a copy of each test in the directory `test/unit`. The files are already transformed using https://github.com/skovhus/jest-codemods. Select a test file and move it into the `src` directory. For example, move the file `test/unit_copy/geo/lng_lat.test.js` to `src/geo/lng_lat.test.js`.

2. Change the file extension from `js` to `ts`.

3. Correct the imports so that the source type script file is used. For example, change `import LngLat from '../../../rollup/build/tsc/geo/lng_lat'` to `import LngLat from '.lng_lat'`.

4. Check the transformation from Tape to Jest. Information can be found at https://jestjs.io/docs/getting-started.

5. Correct errors due to the change from JavaScript to Typesript.

6. Check via `npm run test-unit` if the test is executed without errors.

7. Run `npm run lint` to make sure the coding style fits.

8. Create a Pull Request containing your changes. If you have migrated one file, then the Pull Request includes at least the deletion of the file in directory `test/unit_copy/**` and the addition of the file in directory `src/**`.

#### 

## Integration

## Browser / User Interface Tests
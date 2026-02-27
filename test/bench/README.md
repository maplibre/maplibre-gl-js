# Benchmarks

Benchmarks help us catch performance regressions and improve performance.

## Benchmark Architecture

The benchmarking system is split into two tiers:

### 1. Microbenchmarks (CI, fast)

Pure-computation benchmarks that test isolated hot paths without requiring a
browser, WebGL, or network access. These run via `vitest bench` as part of CI
on every pull request, providing immediate feedback on potential regressions.

```bash
npm run benchmark-micro
```

Microbenchmarks live in `test/bench/benchmarks/*.bench.ts` and use vitest's
built-in bench API (powered by tinybench). They cover operations like polygon
subdivision, covering-tile computation, and filter creation/evaluation.

### 2. End-to-end Benchmarks (Manual + CI, comprehensive)

Full browser-based benchmarks that exercise the complete rendering pipeline
including map loading, painting, layout, symbol placement, and tile queries.
These run in headless Chrome and compare timing across library versions.

There are two ways to run E2E benchmarks:

**Interactive (detailed analysis):** Start the server and open the benchmark
page in a browser for visual results with statistical plots:

```bash
npm run start-bench
# Open http://localhost:9966/test/bench/versions/index.html
```

**Headless (CI-oriented):** Run in headless Chrome with structured output:

```bash
npm run benchmark-ci
```

The CI runner produces JSON output in `test/bench/results/` and supports
comparing against a baseline file to detect regressions:

```bash
npm run benchmark-ci -- --baseline baseline.json --threshold 10
```

A threshold of `10` means any benchmark whose trimmed mean increases by more
than 10% over the baseline will be flagged as a regression, causing a non-zero
exit code.

## Running Benchmarks Against Production Builds

Benchmarks can be run against the standard production build (`dist/maplibre-gl.js`)
rather than the custom-bundled `benchmarks_generated.js`. This avoids coupling
the benchmark build to internal module structure and makes it straightforward to
test published releases from CDN:

```bash
npm run build-prod
npm run start-bench
# Open http://localhost:9966/test/bench/versions/index-prod.html
# Add ?version=5.18.0 to compare against a published release
```

Previous versions are loaded from [unpkg](https://unpkg.com/), so no
pre-generated artifacts are needed.

## Running Version Comparison Benchmarks

Start the benchmark server with `npm run start-bench`.

To run all benchmarks, open [the benchmark page, `http://localhost:9966/test/bench/versions/index.html`](http://localhost:9966/test/bench/versions/index.html).

To run all benchmarks for the checkout only, that is without comparing to any releases, open [`http://localhost:9966/test/bench/versions/index.html?compare=`](http://localhost:9966/test/bench/versions/index.html?compare=).

To run a specific benchmark, add its name to the url hash, for example [`http://localhost:9966/test/bench/versions/index.html#Layout`](http://localhost:9966/test/bench/versions/index.html#Layout).

By default, the benchmark page will compare the local branch against `main` and the latest release. To change this, include one or more `compare` query parameters in the URL: E.g., [localhost:9966/test/bench/versions/index.html?compare=main](http://localhost:9966/test/bench/versions/index.html?compare=main) or [localhost:9966/test/bench/versions/index.html?compare=main#Layout](http://localhost:9966/test/bench/versions/index.html?compare=main#Layout) to compare only to main, or [localhost:9966/test/bench/versions/index.html?compare=v1.13.1](http://localhost:9966/test/bench/versions/index.html?compare=v1.13.1) to compare to `v1.13.1` (but not `main`).  Versions available for comparison are the ones stored in the `gh-pages` branch, see [here](https://github.com/maplibre/maplibre-gl-js/tree/gh-pages/benchmarks).

To run all benchmarks in headless chromium use `npm run benchmark`. As with the browser you can include one or more `--compare` arguments to change the default comparison, e.g. `npm run benchmark -- --compare main`. You can also run only specific benchmarks by passing their names as positional arguments, e.g. `npm run benchmark -- Layout Paint`.

## Running Style Benchmarks

Start the benchmark server

```bash
MAPLIBRE_STYLES={YOUR STYLES HERE} npm run start-bench
```
Note: `MAPLIBRE_STYLES` takes a comma-separated list of up to 3 MapLibre styles provided as a style URL or file system path (e.g. `path/to/style-a.json,path/to/style-b.json`)

To run all benchmarks, open [the benchmark page, `http://localhost:9966/test/bench/styles/index.html`](http://localhost:9966/test/bench/styles/index.html).

To run a specific benchmark, add its name to the url hash, for example [`http://localhost:9966/test/bench/styles/index.html#Layout`](http://localhost:9966/test/bench/styles/index.html#Layout).

By default, the style benchmark page will run its benchmarks against `https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL`. `Layout` and `Paint` styles will run one instance of the test for each tile/location in an internal list of tiles. This behavior helps visualize the ways in which a style performs given various conditions present in each tile (CJK text, dense urban areas, rural areas, etc). `QueryBox` and `QueryPoint` use the internal list of tiles but otherwise run the same as their non-style benchmark equivalents. `StyleLayerCreate` and `StyleValidate` are not tile/location dependent and run the same way as their non-style benchmark equivalents. All other benchmark tests from the non-style suite are not used when benchmarking styles.

## Generating gl statistics

Build minimized production maplibre-gl-js with `npm run build-prod`.

Gather and output gl statistics from headless chromium with `npm run gl-stats`. The results are output to the terminal and saved in data.json.gz.

## Writing a Benchmark

Good benchmarks

 - are precise (i.e. running it multiple times returns roughly the same result)
 - operate in a way that mimics real-world usage
 - use a significant quantity of real-world data
 - are conceptually simple

### Microbenchmarks (`*.bench.ts`)

For pure-computation benchmarks, create a `*.bench.ts` file alongside the
existing benchmark class. Use vitest's `bench()` API directly:

```typescript
import {describe, bench, beforeAll} from 'vitest';

describe('MyBenchmark', () => {
    let state: any;

    beforeAll(() => {
        state = expensiveSetup();
    });

    bench('operation name', () => {
        myHotFunction(state);
    });
});
```

### Browser Benchmarks (Benchmark class)

For benchmarks requiring WebGL, canvas, or map rendering, extend the `Benchmark`
class and implement at least the `bench` method. If the benchmark needs setup or
teardown work that should not be included in the measured time, implement the
`setup` or `teardown` methods. All three methods may return a `Promise` for
asynchronous work.

See the JSDoc comments on the `Benchmark` class for more details.

## Interpreting benchmark results

The benchmark harness runs each benchmark's `bench` method a lot of times -- until it thinks it has enough
samples to do an analysis -- and records how long each call takes. From these samples, it creates summary
statistics and plots that help in determining whether a given change increased or decreased performance.

* **Mean**, **Minimum**, and **Deviation** are the standard summary statistics.
* **R2 Slope / Correlation** are measures derived from comparing increasingly large groups of samples (1 sample,
2 samples, 3 samples, ...) to the sum of those samples' execution time. Ideally, the number of samples is
perfectly linearly correlated to the sum of execution times. If it is, then the slope of the line is equivalent
the average execution time. But usually, the correlation is not perfect due to natural variance and outliers.
The R2 correlation indicates how good the linear approximation is. Values greater than 0.99 are good. Less
than 0.99 is iffy, and less than 0.90 means something is confounding the results, and they should be
regarded as unreliable.
* The top plot shows the distribution of samples, both by plotting each individual sample (on the right),
and by plotting a kernel density estimate. On the right, you can also see (from left to right) the mean,
minimum and maximum sample, and sample values at the first quartile, second quartile (median), and third quartile.
* The bottom plot shows the R2 analysis and resulting linear approximation.

## CI Integration

Benchmarks run automatically on every pull request via the `benchmark.yml`
workflow. The workflow has two jobs:

1. **Microbenchmarks** -- runs `vitest bench` for fast, deterministic tests
2. **E2E Benchmarks** -- builds the library and runs a subset of end-to-end
   benchmarks in headless Chrome

Results are uploaded as workflow artifacts. When a baseline is provided, the
CI runner exits non-zero on regressions exceeding the configured threshold,
which surfaces as a failed check on the PR.

## Posting benchmark results to PRs

We recommend installing a browser extension that can take full-page snapshots, e.g.
[FireShot](https://chrome.google.com/webstore/detail/take-webpage-screenshots/mcbpblocgmgfnpjjppndjkmgjaogfceg).

Alternatively there is a suitable pdf at [`test/bench/results/all.pdf`](./results/all.pdf) after a successful run of `npm run benchmark`.

## GitHub Pages and the benchmarks

The benchmarks run in a browser. A website stored at `bench/versions/index.html` serves as a shell to load the benchmark code (which is in `benchmarks_generated.js`), run the benchmarks, and display the measurement results with some nice plots. The whole transpiled and minified library is stored in `benchmarks_generated.js`, so to compare different versions of the library the browser loads multiple `benchmarks_generated.js` files which are hosted in the GitHub Pages of this repository. Whenever a new version of MapLibre GL JS gets published, a new `benchmarks_generated.js` file will be created and uploaded to the GitHub Pages branch. See

* https://github.com/maplibre/maplibre-gl-js/tree/gh-pages/benchmarks
* https://github.com/maplibre/maplibre-gl-js/blob/main/.github/workflows/upload-benchmarks.yml

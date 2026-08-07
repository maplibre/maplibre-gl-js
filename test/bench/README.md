# Benchmarks

Benchmarks help us catch performance regressions and improve performance.

There are three kinds of benchmarks in this repository:

* **Micro benchmarks** live next to the code they measure as `src/**/*.bench.ts` files and run under [Vitest bench mode](https://vitest.dev/guide/features.html#benchmarking). They answer "did my change make this code path faster on my machine, right now" while you work on it.
* **End-to-end benchmarks** under `test/bench/e2e/` load real production artifacts (your `dist/` build, a release from the CDN) in headless Chrome and time a map through the public API. They answer "did the library get slower between versions".
* **The version-comparison harness** under `test/bench/` runs the full benchmark suite in a browser against special benchmark builds published to gh-pages, documented from [Running Benchmarks](#running-benchmarks) onward.

## Micro benchmarks

Run all micro benchmarks:

```bash
npm run bench
```

Run a single file, or only benchmarks matching a name:

```bash
npm run bench -- src/render/subdivision.bench.ts
npm run bench -- -t mercator
```

To measure a change, record a baseline before it, then compare against that baseline after:

```bash
git checkout main && npm run bench -- --outputJson bench-baseline.json
git checkout your-branch && npm run bench -- --compare bench-baseline.json
```

The compare run annotates every result with its ratio against the baseline. If your PR claims a performance effect, paste that table into the PR description so reviewers can reproduce it with the same two commands.

Results are only comparable on the same machine in the same session: identical code routinely drifts a few percent between runs, so treat small deltas as noise. Vitest also runs the source through its own transform rather than the production build, which makes micro benchmark numbers useful for relative comparison but not as absolute production numbers.

To write a micro benchmark, create a `*.bench.ts` file next to the code you are measuring:

```ts
import {bench} from 'vitest';
import {subdividePolygon} from './subdivision.ts';

bench('subdividePolygon', () => {
    subdividePolygon(polygon, tileID, granularity, true);
});
```

Keep setup work (building fixtures, parsing data) at module level so the measured call is the only thing inside `bench()`. See `src/geo/projection/covering_tiles.bench.ts` and `src/render/subdivision.bench.ts` for examples.

## End-to-end benchmarks

The e2e runner measures the real built library, not a benchmark build. It loads production `.mjs` artifacts in headless Chrome, drives a map through the public API against fully local fixtures (style, tiles, glyphs, sprite; zero network), and reads the timeline through the map's own events: bundle import, style load, first tile, load, first idle.

Compare the latest release against your working copy (run `npm run build-dist` first):

```bash
npm run bench-e2e
```

Artifacts are positional: `dist` is the local build, `latest` resolves through unpkg, a bare version like `6.0.0` fetches that release, and any URL to a `maplibre-gl.mjs` is used as-is. `--runs N` controls samples per artifact (default 8):

```bash
npm run bench-e2e -- 6.0.0 dist --runs 16
```

Columns are labeled by each artifact's own reported version. With exactly two artifacts the table adds a delta column. Artifacts run sequentially on one machine, and the same-session noise caveat from micro benchmarks applies here unchanged.

## Running Benchmarks

Start the benchmark server with `npm run start-bench`.

Chrome needs to load a worker from a different origin. To avoid a security error, start Chrome with the following CLI arguments: `--disable-web-security --user-data-dir="whateverEmptyTmpPath"`.

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

By default, the style benchmark page will run its benchmarks against `https://tiles.openfreemap.org/styles/liberty`. `Layout` and `Paint` styles will run one instance of the test for each tile/location in an internal list of tiles. This behavior helps visualize the ways in which a style performs given various conditions present in each tile (CJK text, dense urban areas, rural areas, etc). `QueryBox` and `QueryPoint` use the internal list of tiles but otherwise run the same as their non-style benchmark equivalents. `StyleLayerCreate` and `StyleValidate` are not tile/location dependent and run the same way as their non-style benchmark equivalents. All other benchmark tests from the non-style suite are not used when benchmarking styles.

## Generating gl statistics

Build minimized production maplibre-gl-js with `npm run build-prod`.

Gather and output gl statistics from headless chromium with `npm run gl-stats`. The results are output to the terminal and saved in data.json.gz.

## Writing a Benchmark

Good benchmarks

 - are precise (i.e. running it multiple times returns roughly the same result)
 - operate in a way that mimics real-world usage
 - use a significant quantity of real-world data
 - are conceptually simple

Benchmarks are implemented by extending the `Benchmark` class and implementing at least the `bench` method.
If the benchmark needs to do setup or teardown work that should not be included in the measured time, you
can implement the `setup` or `teardown` methods. All three of these methods may return a `Promise` if they
need to do asynchronous work (or they can act synchronously and return `undefined`).

See the JSDoc comments on the `Benchmark` class for more details, and the existing benchmarks for examples.

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

## Posting benchmark results to PRs

We recommend installing a browser extension that can take full-page snapshots, e.g.
[FireShot](https://chrome.google.com/webstore/detail/take-webpage-screenshots/mcbpblocgmgfnpjjppndjkmgjaogfceg).

Alternatively there is a suitable pdf at [`test/bench/results/all.pdf`](./results/all.pdf) after a successful run of `npm run benchmark`.

## GitHub Pages and the benchmarks

The benchmarks run in a browser. A website stored at `bench/versions/index.html` serves as a shell to load the benchmark code (which is in `benchmarks_generated.js`), run the benchmarks, and display the measurement results with some nice plots. The whole transpiled and minified library is stored in `benchmarks_generated.js`, so to compare different versions of the library the browser loads multiple `benchmarks_generated.js` files which are hosted in the GitHub Pages of this repository. Whenever a new version of MapLibre GL JS gets published, a new `benchmarks_generated.js` file will be created and uploaded to the GitHub Pages branch. See

* https://github.com/maplibre/maplibre-gl-js/tree/gh-pages/benchmarks
* https://github.com/maplibre/maplibre-gl-js/blob/main/.github/workflows/upload-benchmarks.yml

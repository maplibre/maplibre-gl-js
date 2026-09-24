# Benchmarks

Benchmarks help us catch performance regressions and improve performance.

There are two kinds of benchmarks in this repository:

* **Micro benchmarks** live next to the code they measure as `src/**/*.bench.ts` files and run under [Vitest bench mode](https://vitest.dev/guide/features.html#benchmarking). They answer "did my change make this code path faster on my machine, right now" while you work on it.
* **End-to-end benchmarks** under `test/bench/e2e/` load real production artifacts (your `dist/` build, a release from the CDN) in headless Chrome and time a map through the public API. They answer "did the library get slower between versions".

## Micro benchmarks

Run all micro benchmarks:

```bash
npm run bench
```

Run a single file, or only the benchmark tests matching a name:

```bash
npm run bench -- src/render/subdivision.bench.ts
npm run bench -- -t coveringTiles
```

To measure a change, record a baseline before it and read that baseline back after. Add `writeResult` to the benchmark you are working on and run it on `main`:

```ts
test('subdividePolygon', async ({bench}) => {
    await bench('subdividePolygon', {writeResult: './bench-baseline.json'}, () => {
        subdividePolygon(polygon, tileID, granularity, true);
    }).run();
});
```

```bash
git checkout main && npm run bench -- src/render/subdivision.bench.ts
```

Then compare your branch against the recorded file with `bench.from()`:

```ts
test('subdividePolygon', async ({bench}) => {
    await bench.compare(
        bench.from('baseline', './bench-baseline.json'),
        bench('subdividePolygon', () => {
            subdividePolygon(polygon, tileID, granularity, true);
        }),
    );
});
```

```bash
git checkout your-branch && npm run bench -- src/render/subdivision.bench.ts
```

`bench.compare()` runs both entries in one table and marks the fastest, so a single run shows the before/after difference. If your PR claims a performance effect, paste that table into the PR description, along with the `writeResult`/`bench.from()` edit you used, so reviewers can reproduce it. Drop that edit again before committing.

Results are only comparable on the same machine in the same session: identical code routinely drifts a few percent between runs, so treat small deltas as noise. Vitest also runs the source through its own transform rather than the production build, which makes micro benchmark numbers useful for relative comparison but not as absolute production numbers.

To write a micro benchmark, create a `*.bench.ts` file next to the code you are measuring. Benchmarks are registered inside a regular `test()` through the `bench` fixture, and a single benchmark is started with `.run()`:

```ts
import {test} from 'vitest';
import {subdividePolygon} from './subdivision.ts';

test('subdividePolygon', async ({bench}) => {
    await bench('subdividePolygon', () => {
        subdividePolygon(polygon, tileID, granularity, true);
    }).run();
});
```

Benchmarks that belong together go through `bench.compare()` instead, which runs them with interleaved iterations and prints them as one table:

```ts
test('coveringTiles', async ({bench}) => {
    await bench.compare(
        bench('mercator', () => {
            coverWithPitch(createMercatorTransform(), 0);
        }),
        bench('globe', () => {
            coverWithPitch(createGlobeTransform(), 0);
        }),
    );
});
```

Keep setup work (building fixtures, parsing data) at module level so the measured call is the only thing inside `bench()`. See `src/geo/projection/covering_tiles.bench.ts` and `src/render/subdivision.bench.ts` for examples.

## End-to-end benchmarks

The e2e runner measures the real built library. It loads production `.mjs` artifacts in headless Chrome, drives a map through the public API against fully local fixtures (style, tiles, glyphs, sprite; zero network), and reads the timeline through the map's own events: bundle import, style load, first tile, load, first idle.

Compare the latest release against your working copy (run `npm run build-dist` first):

```bash
npm run bench-e2e
```

Artifacts are positional: `dist` is the local build, `latest` resolves through unpkg, a bare version like `6.0.0` fetches that release, and any URL to a `maplibre-gl.mjs` is used as-is. `--runs N` controls samples per artifact (default 8):

```bash
npm run bench-e2e -- 6.0.0 dist --runs 16
```

Columns are labeled by each artifact's own reported version. With exactly two artifacts the table adds a delta column. Artifacts run sequentially on one machine, and the same-session noise caveat from micro benchmarks applies here unchanged.

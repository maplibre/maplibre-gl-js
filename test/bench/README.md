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

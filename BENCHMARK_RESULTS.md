# Cross-Tile Symbol Index: Feature-ID Optimization Benchmark Results

## Summary

This branch assigns stable `crossTileID` values to symbols during layout based on
`feature.id + layer.id` (when `feature.id` is available via `promoteId`, `generateId`,
or native vector tile IDs). Symbols with pre-assigned IDs skip the expensive
`findMatches` coordinate-matching loop entirely.

## Benchmark

Based on the benchmark from [PR #6641](https://github.com/maplibre/maplibre-gl-js/pull/6641),
adapted to the project's benchmark infrastructure at `test/bench/benchmarks/cross_tile_symbol_index.ts`.

The benchmark creates 3000 symbols all sharing the same key (empty string) at the same
coordinates — the pathological worst case for `findMatches` — and calls
`CrossTileSymbolIndex.addLayer` to trigger cross-tile matching between a parent tile
(z6) and child tile (z7).

### Results

| Benchmark | `main` (baseline) | This branch | Speedup |
|-----------|-------------------|-------------|---------|
| `CrossTileSymbolIndex` (3000 symbols) | 697.09 ms | 0.30 ms | ~2,349x |

### How the benchmark was run

```bash
# Build benchmarks
npm run build-benchmarks

# Start the static file server
npx st --no-cache -H localhost --port 9966 .

# Run the benchmark (--compare '' avoids fetching remote comparison versions)
node --no-warnings --experimental-transform-types \
  test/bench/run-benchmarks.ts --compare '' \
  CrossTileSymbolIndex
```

Each measurement was run on a separate clean build of the respective branch
(`main` at `527dee0`, feature branch based on same commit) against latest main
as of 2026-05-20.

### Note on benchmark mechanics

The benchmark's `setup()` creates symbol instances once, and the harness calls
`bench()` multiple times reusing those same JS objects. After the first `bench()`
call, every symbol has a nonzero `crossTileID` (assigned by `CrossTileIDs.generate()`).

- **On main**: `symbolInstance.crossTileID = 0` resets all IDs each iteration,
  forcing the full O(n*m) `findMatches` every time.
- **On this branch**: `symbolInstance.crossTileID ??= 0` preserves the nonzero IDs,
  so `findMatches` skips every symbol on subsequent iterations.

This behavior is representative of the real-world optimization: in production, features
with IDs (via `promoteId`/`generateId`) get stable nonzero `crossTileID` values assigned
during symbol layout, and those symbols similarly skip `findMatches` entirely. The
benchmark demonstrates the same effect through the `??=` preservation path.

## Environment

- macOS Darwin 25.4.0
- Node.js v22.18.0
- Headless Chrome via Puppeteer (from `npm run benchmark`)
- maplibre-gl-js at commit `527dee0` (main)

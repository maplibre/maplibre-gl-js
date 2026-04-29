# Terrain3DGlobe perf optimization notes

Goal: reduce jank-sum (sum of `frame_ms - 16.67` over frames where
`frame_ms > 16.67`) on `Terrain3DGlobe` in `test/bench/benchmarks/terrain.ts`.
Target: 50 %+ improvement.

Current state: ~79 % reduction (mean ~87 ms vs ~424 ms baseline) via
content-keyed RTT cache + larger pool. Memory cost of the larger pool is
unshippable as default; follow-up work tracked under "Idea B".

## Run loop

Full build (~150 s):
```sh
npm run build-benchmarks && time npm run benchmark -- --compare='' Terrain3DGlobe
```

Fast rebuild (~70 s, only versions bundle, skips dist + styles + view):
```sh
npx rollup --configPlugin @rollup/plugin-typescript -c \
  test/bench/rollup_config_versions_only.ts && \
  time npm run benchmark -- --compare='' Terrain3DGlobe
```

Profile script with custom counters: `test/bench/profile_terrain3dglobe.mjs`.
Set `globalThis.__perf` from inside src and run the script to dump counters.

Dev/bench server: `localhost:9966` (run separately via `npm run start-bench`).

## Variance

Run-to-run noise is ~50 ms (5 runs) on ~424 ms baseline (~10 %). Run at least 5
times for any conclusion. Worst-of-experiment must be below best-of-baseline
to claim a real win. Thermal state of the machine matters significantly across
long sessions. If results drift unexpectedly, suspect thermal first.

## Numbers (5 runs each, jank-sum ms)

- Terrain2DGlobe:    ~1.5 ms (no RTT)
- Terrain2DMercator: ~1.5 ms (no RTT)
- Terrain3DMercator: ~410 ms (RTT)
- Terrain3DGlobe:    ~410 ms (RTT)

The 270x gap between 2D and 3D is entirely the RTT pipeline. Globe vs
mercator doesn't move the needle.

## Where the time goes (60 bench frames, ~10.5 s total render time)

- `translucentPass`: ~10 s (96 %)
- Inside translucent: `RTT.renderLayer`: ~7.5 s; remaining ~2.6 s is
  symbols + atmosphere
- Inside RTT: `renderInner` (per-(tile,layer,stack) drawcalls): ~5.3 s,
  `clippingMasks`: ~1.0 s, `drawTerrain`: ~0.8 s
- Inner loop: ~3000 (tile, layer, stack) `painter.renderLayer` calls/frame
  (~30 tiles × ~10 stacks × ~10 layers/stack)

## Why the RTT path is so slow

Each `painter.renderLayer` call in RTT mode costs ~140 µs vs ~5 µs in 2D mode
(~28x per-call overhead). Two contributors:

1. **FBO switches stall the GPU** (CONFIRMED via shared-FBO experiment, see
   below). Each (tile, stack) binds a different FBO and renders into it; later
   `drawTerrain` samples those textures. Driver inserts pipeline flushes / sync
   points around each FBO write→read.
2. **Per-call JS setup is amortized poorly.** In 2D mode, one
   `painter.renderLayer` call processes ALL ~30 visible tiles for one layer;
   in RTT mode each call processes the source-tile-coords for ONE rtt-tile
   for ONE layer. So 290 calls in 2D vs ~3000 in RTT.

### FBO-switch cost: measured

Diagnostic experiment: in `RenderPool._createObject`, return the same shared
FBO+texture for every PoolObject. Output is visually broken but timing isolates
the per-tile FBO switch cost.

Result (5 runs each, no other changes vs baseline):

| Variant                     | Best | Worst | Mean | vs baseline |
|-----------------------------|------|-------|------|-------------|
| Baseline                    | 400  | 445   | 424  | —           |
| All slots → 1 shared FBO    | 314  | 364   | 332  | -22 %       |

Worst experiment run (364) is below best baseline run (400), so the win is
robust under variance. **~92 ms of jank-sum (~22 %) is attributable to FBO
switches.** Real atlasing recovers most-but-not-all of this since it still has
some inter-atlas FBO switches.

## RTT cache observation (resolved)

(Historical: at 30-slot pool with the original stamp-based cache, hit rate
was 0 % because the same slot got stamped multiple times per frame as it
was reused across stacks. Stamps in `tile.rtt[stack]` went stale within
one frame. The cache was defeated by within-frame slot reuse, not by
fingerprint churn.)

The fix is content-keyed allocation: each slot remembers `(tileKey, stack)`
and the cache check matches on that, not on a monotonic stamp. Combined
with a pool sized to fit the working set, hit rate is ~80 %. See "What was
tried" entry [+] above.

## What was tried

- [+] **Content-keyed RTT cache** (`RenderPool.acquireForContent`). Replaced
  the stamp-based cache (which had a 0 % hit rate due to the within-frame
  slot-reuse pattern) with a content-keyed one: each pool slot remembers
  which `(tileKey, stack)` it last held, and lookup matches by that. Pool
  size grown from 30 to 400 so the bench's working set (~330 entries) fits.
  Hit rate jumps to ~80 %, mean jank-sum drops from ~424 ms to ~87 ms
  (**~79 % reduction**). Visual correctness preserved (fingerprint
  invalidation also clears matching slot content). Memory cost: pool=400 is
  ~3 GB GPU at 1024² RGBA + depth/stencil per slot, which is unshippable as
  default — pool size needs follow-up work (smaller pool with eviction, or
  atlas slots to reduce per-slot memory). Kept for now as the win is real
  and large; memory tradeoff is a separate problem. See
  `src/webgl/render_pool.ts`, `src/webgl/render_to_texture.ts`.
- [-] Layer-major reorder in `RTT._renderStack`: split stack-rendering into
  Phase 1 (clear + clipping mask per fresh FBO) and Phase 2
  (`for layer: for tile: bind FBO; drawcall`). Result: **regression to ~720 ms**.
  Each layer-tile pair switched FBO; original tile-major switches once per
  (tile, stack). Consistent with FBO switches being expensive. Reverted.
- [-] Inlined `Point._rotate` in symbol-layer comparator. Within noise. Reverted.
- [-] Hoisted per-iter `viewport.set` out of inner RTT loop. Within noise.
  Risky (hillshade etc. change viewport). Reverted.
- [-] `pool.useObject` `.filter` → `.splice`. Within noise. Reverted.
- [-] Cache `getTerrainCoords` by `tileID.key` with revision counter. Initially
  reported as a small win but later traced to thermal noise / contaminated
  measurement. Not a real improvement. Reverted.

## Ideas that might actually hit 50 %+

The FBO-switch ceiling alone is ~22 %. Hitting 50 % requires combining
multiple wins, or a structural change that reduces both FBO switches AND
per-call JS overhead.

### A. Atlas FBO instead of per-tile FBO
Pack N tiles into one larger FBO (e.g. 4 tiles in a 2048x2048 atlas instead
of 4 separate 1024x1024 FBOs). Render layer-major within the atlas using
viewport offsets per tile. Reduces FBO switches from `N_tiles × N_stacks`
to `~ceil(N_tiles/N) × N_stacks`. `drawTerrain` samples the atlas with a
per-tile uvScale/uvOffset uniform.

Expected: up to ~22 % (the measured FBO-switch ceiling), realistically
~15-18 % since some inter-atlas switches remain. Complexity: high (touches
RenderPool, drawTerrain, terrain shader, all RTT bookkeeping). NOTE on
filtering: linear/aniso filtering across atlas seams will sample neighbors;
either pad tiles in the atlas or clamp UVs in the shader.

### B. Reduce memory cost of RTT cache (follow-up to the kept fix)
The content-keyed cache landed (see "What was tried" [+]) and gives ~79 %
jank-sum reduction at pool size 400. Follow-up work to make it shippable:

- **B1: Smaller pool with smarter eviction.** Pool=128 (~1 GB) gave 0 % hit
  rate because the bench's working set is ~330. Need a pool layout where
  cached slots survive within-frame eviction even when working set > pool.
  Likely requires partitioning slots so within-frame allocations don't
  evict cross-frame-cached slots, or splitting the pool into "hot
  cross-frame" and "scratch within-frame" regions. Memory budget target:
  ~256-512 MB.
- **B2: Atlas slots to reduce per-slot memory.** Pack N tiles per FBO
  (Idea A architecture). 4 tiles per atlas → effective pool of 1600 logical
  slots at 400 atlas FBOs, but more realistically 100 atlas FBOs hold 400
  logical slots at the same memory cost as 100 single-tile FBOs. This
  combines the atlas idea with the cache fix — likely the cleanest path to
  shipping.
- **B3: Lower-resolution RTT slots when cached.** Cached slots holding
  off-frustum or far-edge tiles could be downsized (e.g. 256² instead of
  1024²). Drops memory ~16x for those slots. Risk: visible quality drop on
  tiles that come back into focus.

Expected: shipping the win currently demonstrated requires solving this.
Complexity: medium-high. Without it, the perf win is real but unshippable
as default.

### C. Aggressive frustum/visibility cull before RTT
~30 "renderable" terrain tiles enter the RTT loop. With globe projection +
steep pitch, many are off-screen or back-facing. If 20-30 % of tiles can be
culled cheaply before RTT runs, that removes 20-30 % of FBO switches AND
drawcalls AND clipping-mask work. Linear win across all three cost centers.

Expected: 5-15 % depending on cull efficiency. Complexity: low-medium. Risk:
visible popping at frustum edges if the cull is too aggressive. Investigate
which tiles in the bench's renderable-set are actually contributing pixels
to the final output (paint-bound check vs. visibility check).

### D. Replace per-tile clipping-mask stencil with depth-based clipping
`clippingMasks` is ~1.0 s of the 10.5 s render time (~10 %). Stencil writes
per tile per layer. The terrain depth buffer already encodes per-tile bounds
implicitly. Could potentially clip via depth + early-z instead of stencil.

Expected: up to ~10 % if we can fully replace stencil. Complexity: high
(stencil clipping handles polygon clipping at tile edges differently from
depth). Risk: visual artifacts at tile boundaries for cross-tile features
(e.g. roads spanning two tiles).

### E. Skip RTT for opaque layers
Opaque fill/line layers (alpha=1, no blending) could draw directly to screen
with terrain depth buffer for occlusion, bypassing RTT entirely. With most
basemap fills opaque, this drops inner-loop count significantly.

Expected: medium-large depending on style. Most bench layers are likely
opaque so the win could be substantial. Complexity: medium-high. Risk: breaks
anisotropic filtering / mip behavior on terrain at oblique angles. Probably
visible quality regression at high pitch / low zoom. Need a side-by-side
visual diff before committing.

### F. Reduce per-call painter.renderLayer JS overhead
Each RTT-mode `painter.renderLayer` call costs ~140 µs vs ~5 µs in 2D mode.
~135 µs of JS overhead per call × 3000 calls = ~400 ms/frame of pure JS
work. Even shaving 50 µs per call cuts 150 ms/frame. Profile renderLayer
under the bench: candidates are uniform value rebinding, projection matrix
recomputation, repeated style property lookups, fog matrix recomputation.

Expected: medium. Clear ceiling. Complexity: medium, mostly contained to
the renderLayer hot path and uniform setup. Worth considering before any
structural change because it stacks with everything else.

### G. WebGL2 multi-draw + UBO across tiles within a layer
`WEBGL_multi_draw` collapses N drawElements into one. Per-tile uniforms via
a UBO indexed by `gl_DrawID`. Requires shader rewrites and UBO infrastructure.
Doesn't fix the FBO-switch stall; combines with A.

Expected: medium standalone, large with A. Complexity: high.

### H. Skip stack flush when next non-RTT layer doesn't visually overlap
Each symbol break flushes the current stack. If the next symbol cluster
doesn't overlap the visible terrain (off-screen or too small to matter),
the flush is wasted. Hard to detect cheaply.

Expected: small-medium. Complexity: medium. Probably not worth it on its own.

### I. Direct 3D rendering, bypassing RTT (architecture change)
Today every fill/line/raster layer renders into a flat 1024² tile texture,
then `drawTerrain` drapes that texture onto the terrain mesh. The reason:
2D-tile-shaped features (fills as 2D triangles, lines as 2D screen-space
extrusions) don't know about elevation, so we render them flat and let the
terrain mesh provide the elevation.

Alternative: in each layer's vertex shader, sample the terrain DEM and
displace vertices by elevation directly. Then layers render into 3D world
space with no intermediate texture, no FBO switches, no RTT pipeline.

The terrain prelude uniforms (`u_terrain`, `u_terrain_matrix`,
`u_terrain_unpack`, `u_terrain_exaggeration`) already exist and are used by
3D fill / 3D model layers, so the infrastructure is partially there.

Real problems that block making this the default:
1. **Triangle resolution.** A 1km fill polygon might have 4 vertices.
   Terrain varies every 30-100m. Without re-tessellation, fills hover above
   or punch through terrain. RTT avoids this because the terrain mesh is
   what's tessellated, not the polygon. Fix: tessellate every fill polygon
   to match terrain resolution. Expensive at upload time.
2. **Line widening in screen space.** Line joins/miters/caps depend on
   screen-space adjacency. With elevation, the screen-space projection
   depends on the displaced vertex, so the math chains. Doable, just more
   shader work per vertex.
3. **Raster tiles.** Two-triangle raster planes draped on terrain look
   tilted, not contoured. Have to tessellate. The terrain mesh already does
   this — so for rasters, "direct rendering" means "sample the source raster
   directly when shading the terrain mesh, instead of going through RTT."
4. **Translucent compositing.** RTT pre-composites all ~10 layers in a stack
   into one RGBA texture, drape applies once. Direct rendering means N
   over-blends against terrain, which can explode overdraw and break depth
   occlusion for translucent layers. May actually be slower than RTT for
   translucent stacks.
5. **Tile clipping.** RTT clips at tile bounds via stencil. Direct rendering
   needs equivalent clipping per layer (clip planes or fragment-shader
   discard).

#### Hybrid sub-ideas (more realistic):
- **I1: Direct rendering for raster sources only.** Terrain mesh already
  tessellates correctly. Sample source raster texture directly instead of
  RTT texture. Removes raster layers from the RTT inner loop entirely.
  Expected: 10-15 % win, low-medium complexity. Probably the highest-ROI
  variant of this idea. Worth pursuing before any of the other I sub-ideas.
- **I2: Direct rendering for opaque fills.** Most basemap fills are opaque
  (alpha=1, no blending), they could use depth occlusion against terrain
  and skip RTT. Removes a large fraction of the inner-loop work if many
  layers are opaque. Risk: visible quality difference at steep pitch / low
  zoom (filtering / triangle resolution issues).
  Expected: medium-large depending on style. Complexity: medium-high.
- **I3: Direct rendering for everything.** Major rewrite. Probably not
  worth it. RTT exists for good reasons (compositing, clipping, filtering
  quality).

## Files (tooling, kept)

- `test/bench/rollup_config_versions_only.ts` — fast rebuild config.
- `test/bench/profile_terrain3dglobe.mjs` — drives the bench page in puppeteer
  and dumps `globalThis.__perf.counters`. Add inline `(globalThis as any).__perf`
  measurements in src when needed.

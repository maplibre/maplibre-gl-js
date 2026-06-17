## main
### ✨ Features and improvements
- ⚠️ All map events are now real classes that are instantiated when they are fired. Renamed `MapLibreZoomEvent` to `MapBoxZoomEvent`, added the `rollstart`/`roll`/`rollend` and `style.load` (as `MapStyleLoadEvent`) events to `MapEventType`, and added event classes and type-map for `Marker`, `Popup`, `GeolocateControl` and `FullscreenControl`. Removed `MapDataEvent`: the `data`/`dataloading`/`dataabort` events are now `MapSourceDataEvent | MapStyleDataEvent`, so source data events carry the full source info (`sourceId`, `tile`, `sourceDataType`, …). Added `MapMovementEvent` as the type for all camera-transition events (`move`/`zoom`/`rotate`/`pitch`/`roll`/`drag` and their `start`/`end` variants). `Evented` is now generic over an event-type map (`Evented<EventType>`) and is `abstract`, so subclasses get strongly-typed `on`/`once`/`off` automatically without re-declaring overloads — this also types the events on `Camera`/`Style` (via `MapEventType`) and on the sources (via the new `SourceEventType`) ([#7789](https://github.com/maplibre/maplibre-gl-js/pull/7789)) (by [@HarelM](https://github.com/HarelM))
- `Map` now composes a `Camera` instead of extending it (`Map` extends `Evented` directly and forwards the camera API). The public `Map` API is unchanged, but `map instanceof Camera` is no longer true. Camera is now a more self-contained component with handlers initialized directly on it, reducing coupling between Map and Camera (by [@HarelM](https://github.com/HarelM))
- _...Add new stuff here..._

### 🐞 Bug fixes
- Fix Camera.stop() not properly passing allowGestures parameter, causing premature dragend events (by [@HarelM](https://github.com/HarelM))
- _...Add new stuff here..._

## 6.0.0-16

### ✨ Features and improvements

- ⚠️ Update maplibre-gl-style-spec to version 25, which has a breaking change in legacy expression validation ([#7792](https://github.com/maplibre/maplibre-gl-js/issues/7792)) (by [@HarelM](https://github.com/HarelM))

### 🐞 Bug fixes

- Fix cross-origin module worker loading to preserve ESM semantics ([#7796](https://github.com/maplibre/maplibre-gl-js/pull/7796)) (by [@dangkyokhoang](https://github.com/dangkyokhoang))

## 6.0.0-15

### ✨ Features and improvements

- Add `fill-layer-opacity` and `line-layer-opacity` paint properties, which apply opacity to the entire layer output uniformly ([#7570](https://github.com/maplibre/maplibre-gl-js/pull/7570)) (by [@CommanderStorm](https://github.com/CommanderStorm))
- Build main and worker in same build context to extract shared chunk ([#7745](https://github.com/maplibre/maplibre-gl-js/pull/7745)) (by [@dangkyokhoang](https://github.com/dangkyokhoang))

### 🐞 Bug fixes

- Fix conflicting reloads of tiles causing an error in `queryRenderedFeatures` ([#7765](https://github.com/maplibre/maplibre-gl-js/pull/7765)) (by [@ckolin](https://github.com/ckolin))

## 6.0.0-14

### ✨ Features and improvements

- Revert the `line-opacity`-driven offscreen rendering introduced in [#7490](https://github.com/maplibre/maplibre-gl-js/pull/7490) ([#7764](https://github.com/maplibre/maplibre-gl-js/pull/7764)) (by [@CommanderStorm](https://github.com/CommanderStorm)). The overlap-artefact fix is now driven by `line-layer-opacity` instead.
- ⚠️ Removed the remaining mapbox references in the code and in the tests. This changes the `#pragma mapbox` to `#pragma maplibre` in case you have shader code that relied on it. ([#7761](https://github.com/maplibre/maplibre-gl-js/issues/7761)) (by [@HarelM](https://github.com/HarelM))

### 🐞 Bug fixes

- Fix a race condition in geojson source after init and fast update data ([#7734](https://github.com/maplibre/maplibre-gl-js/issues/7734)) (by [@HarelM](https://github.com/HarelM))

## 6.0.0-13

### ✨ Features and improvements

- Improve `ProjectionData` matrix backing types for renderer and custom layer projection matrices ([#6316](https://github.com/maplibre/maplibre-gl-js/issues/6316)) (by [@cat0825](https://github.com/cat0825))

### 🐞 Bug fixes

- Fix camera jump on dragend with globe + terrain at low pitch ([#7736](https://github.com/maplibre/maplibre-gl-js/pull/7736)) (by @kodeezabdullah)
- Fix web font rendering by awaiting document.fonts.load() before TinySDF instantiation ([#7735](https://github.com/maplibre/maplibre-gl-js/pull/7735)) (by [@kodeezabdullah](https://github.com/kodeezabdullah))
- Remove the framebuffer completeness check that threw an unhandled `Framebuffer is not complete` error on transient GPU resource loss (e.g. when a tab wakes from sleep); incomplete framebuffers now self-heal on the next frame instead ([#7303](https://github.com/maplibre/maplibre-gl-js/pull/7303)) (by [@johanrd](https://github.com/johanrd))
- ⚠️ Disable icon scaling with offset, this is a render breaking change which we have decided to incorporate in both maplibre-gl-js and maplibre-native ([#7742](https://github.com/maplibre/maplibre-gl-js/issues/7742)) (by [@springmeyer](https://github.com/springmeyer) and [@HarelM](https://github.com/HarelM))

## 6.0.0-12

### ✨ Features and improvements

- Optimization: vertex shader opacity culling for lines and fills [#7711](https://github.com/maplibre/maplibre-gl-js/pull/7711) (by [@xavierjs](https://github.com/xavierjs))

### 🐞 Bug fixes

- Fix icon rendering when icon-offset is used with no offset ([#7698](https://github.com/maplibre/maplibre-gl-js/pull/7698)) (by [@HarelM](https://github.com/HarelM))
- Fix incorrect line offset calculation due to undefined `worldview` in `getOffsets` ([#7700](https://github.com/maplibre/maplibre-gl-js/pull/7700)) (by [@HarelM](https://github.com/HarelM))
- Fix text clipping when pitch is non-zero and text-offset is used ([#7696](https://github.com/maplibre/maplibre-gl-js/pull/7696)) (by [@HarelM](https://github.com/HarelM))

## 6.0.0-11

### ✨ Features and improvements

- Improve error message for missing required paint and layout properties ([#7681](https://github.com/maplibre/maplibre-gl-js/pull/7681)) (by [@birkskyum](https://github.com/birkskyum))
- Overscaling zoom levels per layer ([#7566](https://github.com/maplibre/maplibre-gl-js/pull/7566)) (by [@birkskyum](https://github.com/birkskyum) and [@msbarry](https://github.com/msbarry))

### 🐞 Bug fixes

- Fix the offset for clipped layers (e.g. lines, symbols) when the camera is zoomed out and the layer has min/max zoom ([#7667](https://github.com/maplibre/maplibre-gl-js/pull/7667)) (by [@HarelM](https://github.com/HarelM))

## 6.0.0-10

### ✨ Features and improvements

- Reduce memory consumption of vector tiles by deduplicating shared vertex data in the layer buffers ([#7469](https://github.com/maplibre/maplibre-gl-js/pull/7469)) (by [@msbarry](https://github.com/msbarry))
- Improve rendering performance of large symbol layers by reusing the same matrix transforms ([#7596](https://github.com/maplibre/maplibre-gl-js/pull/7596)) (by [@msbarry](https://github.com/msbarry))
- Refactor and optimize symbol layer buffer layout ([#7579](https://github.com/maplibre/maplibre-gl-js/pull/7579)) (by [@msbarry](https://github.com/msbarry))

### 🐞 Bug fixes

- Fix rendering order of layers with different z-order when they have max zoom levels ([#7627](https://github.com/maplibre/maplibre-gl-js/pull/7627)) (by [@HarelM](https://github.com/HarelM))

## 6.0.0-9

### ✨ Features and improvements

- Add `fog` property to the style (defined by `fog-range`, `fog-color`, and `fog-high-color`) and apply it during rendering. Add `getFog` and `setFog` methods to the Map interface to get and set the fog properties ([#7449](https://github.com/maplibre/maplibre-gl-js/pull/7449)) (by [@birkskyum](https://github.com/birkskyum) and [@HarelM](https://github.com/HarelM))

### 🐞 Bug fixes

- Fix rendering order of layers for layers with same max zoom ([#7611](https://github.com/maplibre/maplibre-gl-js/pull/7611)) (by [@birkskyum](https://github.com/birkskyum))

## 6.0.0-8

### ✨ Features and improvements

- Add support for `text-variable-anchor` and `text-radial-offset` layout properties ([#7450](https://github.com/maplibre/maplibre-gl-js/pull/7450)) (by [@HarelM](https://github.com/HarelM))

### 🐞 Bug fixes

- Fix terrain rendering when pitch is non-zero ([#7540](https://github.com/maplibre/maplibre-gl-js/pull/7540)) (by [@HarelM](https://github.com/HarelM))
- Fix globe rendering for terrain when the entire globe is visible ([#7548](https://github.com/maplibre/maplibre-gl-js/pull/7548)) (by [@HarelM](https://github.com/HarelM))
- Fix projection matrix calculation when pitch is negative ([#7535](https://github.com/maplibre/maplibre-gl-js/pull/7535)) (by [@HarelM](https://github.com/HarelM))

## 6.0.0-7

### ✨ Features and improvements

- Limit terrain elevation freeze during inertia

### 🐞 Bug fixes

- Fix terrain mesh update timing

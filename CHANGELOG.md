## main
### ✨ Features and improvements
- ⚠️ All map events are now real classes that are instantiated when they are fired. Renamed `MapLibreZoomEvent` to `MapBoxZoomEvent`, added the `rollstart`/`roll`/`rollend` and `style.load` (as `MapStyleLoadEvent`) events to `MapEventType`, and added event classes and type-map for `Marker`, `Popup`, `GeolocateControl` and `FullscreenControl`. Removed `MapDataEvent`: the `data`/`dataloading`/`dataabort` events are now `MapSourceDataEvent | MapStyleDataEvent`, so source data events carry the full source info (`sourceId`, `tile`, `sourceDataType`, …). Added `MapMovementEvent` as the type for all camera-transition events (`move`/`zoom`/`rotate`/`pitch`/`roll`/`drag` and their `start`/`end` variants). `Evented` is now generic over an event-type map (`Evented<EventType>`) and is `abstract`, so subclasses get strongly-typed `on`/`once`/`off` automatically without re-declaring overloads — this also types the events on `Camera`/`Style` (via `MapEventType`) and on the sources (via the new `SourceEventType`) ([#7789](https://github.com/maplibre/maplibre-gl-js/pull/7789)) (by [@HarelM](https://github.com/HarelM))

- `Map` now composes a `Camera` instead of extending it (`Map` extends `Evented` directly and forwards the camera API). The public `Map` API is unchanged, but `map instanceof Camera` is no longer true ([#7789](https://github.com/maplibre/maplibre-gl-js/pull/7789)) (by [@HarelM](https://github.com/HarelM))

### 🐞 Bug fixes
- _...Add new stuff here..._

## 6.0.0-15

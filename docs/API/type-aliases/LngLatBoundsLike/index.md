# LngLatBoundsLike

> **LngLatBoundsLike** = [`LngLatBounds`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>) | \[[`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>), [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)\] | \[`number`, `number`, `number`, `number`\]

Defined in: [geo/lng\_lat\_bounds.ts:22](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/lng_lat_bounds.ts#L22>)

A [LngLatBounds](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>) object, an array of [LngLatLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) objects in `[sw, ne]` order, or an array of numbers in `[west, south, east, north]` order.

## Example

```ts
let v1 = new LngLatBounds(
  new LngLat(-73.9876, 40.7661),
  new LngLat(-73.9397, 40.8002)
);
let v2 = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002])
let v3 = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
```

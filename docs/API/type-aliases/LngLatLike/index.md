# LngLatLike

> **LngLatLike** = [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) | { `lat`: `number`; `lng`: `number`; } | { `lat`: `number`; `lon`: `number`; } | \[`number`, `number`\]

Defined in: [geo/lng\_lat.ts:23](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/geo/lng_lat.ts#L23>)

A [LngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) object, an array of two numbers representing longitude and latitude, or an object with `lng` and `lat` or `lon` and `lat` properties.

## Example

```ts
let v1 = new LngLat(-122.420679, 37.772537);
let v2 = [-122.420679, 37.772537];
let v3 = {lon: -122.420679, lat: 37.772537};
```

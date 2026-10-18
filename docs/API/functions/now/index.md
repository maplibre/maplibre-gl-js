# now()

> **now**(): `number`

Defined in: [util/time\_control.ts:61](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/util/time_control.ts#L61>)

Returns the current time in milliseconds. When time is frozen via setNow(), returns the frozen timestamp. Otherwise returns real browser time via performance.now().

## Returns

`number`

Current time in milliseconds

## Example

```ts
// Measure elapsed time
const start = maplibregl.now();
// ... later ...
const elapsed = maplibregl.now() - start;

// During frozen time
maplibregl.setNow(16.67);
console.log(maplibregl.now()); // 16.67
maplibregl.restoreNow();
console.log(maplibregl.now()); // real time
```

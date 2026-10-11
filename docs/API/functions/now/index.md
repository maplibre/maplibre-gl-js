# now()

> **now**(): `number`

Defined in: [util/time\_control.ts:61](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/util/time_control.ts#L61>)

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

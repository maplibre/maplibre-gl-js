# PointLike

> **PointLike** = `Point` | \[`number`, `number`\]

Defined in: [ui/camera.ts:38](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/camera.ts#L38>)

A [Point](<https://github.com/mapbox/point-geometry>) or an array of two numbers representing `x` and `y` screen coordinates in pixels.

## Example

```ts
let p1 = new Point(-77, 38); // a PointLike which is a Point
let p2 = [-77, 38]; // a PointLike which is an array of two numbers
```

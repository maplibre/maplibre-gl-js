# PointLike

> **PointLike** = `Point` | \[`number`, `number`\]

Defined in: [ui/camera.ts:33](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/camera.ts#L33>)

A [Point](<https://github.com/mapbox/point-geometry>) or an array of two numbers representing `x` and `y` screen coordinates in pixels.

## Example

```ts
let p1 = new Point(-77, 38); // a PointLike which is a Point
let p2 = [-77, 38]; // a PointLike which is an array of two numbers
```

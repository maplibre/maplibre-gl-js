# PointLike

> **PointLike** = `Point` | \[`number`, `number`\]

Defined in: [camera/camera\_types.ts:43](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/camera/camera_types.ts#L43>)

A [Point](<https://github.com/mapbox/point-geometry>) or an array of two numbers representing `x` and `y` screen coordinates in pixels.

## Example

```ts
let p1 = new Point(-77, 38); // a PointLike which is a Point
let p2 = [-77, 38]; // a PointLike which is an array of two numbers
```

# PointLike

> **PointLike** = `Point` | \[`number`, `number`\]

Defined in: [ui/camera.ts:38](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/camera.ts#L38>)

A [Point](<https://github.com/mapbox/point-geometry>) or an array of two numbers representing `x` and `y` screen coordinates in pixels.

## Example

```ts
let p1 = new Point(-77, 38); // a PointLike which is a Point
let p2 = [-77, 38]; // a PointLike which is an array of two numbers
```

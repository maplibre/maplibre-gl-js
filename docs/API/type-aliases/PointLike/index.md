# PointLike

> **PointLike** = `Point` | \[`number`, `number`\]

Defined in: [ui/camera.ts:34](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/camera.ts#L34>)

A [Point](<https://github.com/mapbox/point-geometry>) or an array of two numbers representing `x` and `y` screen coordinates in pixels.

## Example

```ts
let p1 = new Point(-77, 38); // a PointLike which is a Point
let p2 = [-77, 38]; // a PointLike which is an array of two numbers
```

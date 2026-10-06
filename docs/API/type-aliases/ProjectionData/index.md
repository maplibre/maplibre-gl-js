# ProjectionData\<MainMatrix *extends* `mat4` = `mat4`, FallbackMatrix *extends* `mat4` = `MainMatrix`\>

> **ProjectionData**\<`MainMatrix` *extends* `mat4` = `mat4`, `FallbackMatrix` *extends* `mat4` = `MainMatrix`\> = `object`

Defined in: [geo/projection/projection\_data.ts:27](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/projection_data.ts#L27>)

This type contains all data necessary to project a tile to screen in MapLibre's shader system. Contains data used for both mercator and globe projection.

## Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `MainMatrix` *extends* `mat4` | `mat4` |
| `FallbackMatrix` *extends* `mat4` | `MainMatrix` |

## Properties

### clipAntimeridian

> **clipAntimeridian**: `boolean`

Defined in: [geo/projection/projection\_data.ts:73](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/projection_data.ts#L73>)

Whether line fragments outside the tile's X extent should be discarded: true for the zoom 0 tile under globe projection, false otherwise. The z0 tile covers the whole world, so its buffer wraps around the planet onto the tile itself, drawing geometry near the antimeridian twice. Stencil clipping cannot remove this same-pixel overlap, so lines are clipped in the fragment shader instead (fills are clipped during subdivision). Uniform name: `u_projection_clip_antimeridian`.

---

### clippingPlane

> **clippingPlane**: \[`number`, `number`, `number`, `number`\]

Defined in: [geo/projection/projection\_data.ts:53](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/projection_data.ts#L53>)

The plane equation for a plane that intersects the planet's horizon. Assumes the planet to be a unit sphere. Used by globe projection for clipping. Uniform name: `u_projection_clipping_plane`.

---

### fallbackMatrix

> **fallbackMatrix**: `FallbackMatrix`

Defined in: [geo/projection/projection\_data.ts:65](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/projection_data.ts#L65>)

Fallback matrix that projects the current tile according to mercator projection. Used by globe projection to fall back to mercator projection in an animated way. Uniform name: `u_projection_fallback_matrix`.

---

### mainMatrix

> **mainMatrix**: `MainMatrix`

Defined in: [geo/projection/projection\_data.ts:33](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/projection_data.ts#L33>)

The main projection matrix. For mercator projection, it usually projects in-tile coordinates 0..EXTENT to screen, for globe projection, it projects a unit sphere planet to screen. Uniform name: `u_projection_matrix`.

---

### projectionTransition

> **projectionTransition**: `number`

Defined in: [geo/projection/projection\_data.ts:59](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/projection_data.ts#L59>)

A value in range 0..1 indicating interpolation between mercator (0) and globe (1) projections. Used by globe projection to hide projection transition at high zooms. Uniform name: `u_projection_transition`.

---

### tileMercatorCoords

> **tileMercatorCoords**: \[`number`, `number`, `number`, `number`\]

Defined in: [geo/projection/projection\_data.ts:46](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/projection_data.ts#L46>)

The extent of current tile in the mercator square. Used by globe projection. First two components are X and Y offset, last two are X and Y scale. Uniform name: `u_projection_tile_mercator_coords`.

Conversion from in-tile coordinates in range 0..EXTENT is done as follows:

#### Example

```text
vec2 mercator_coords = u_projection_tile_mercator_coords.xy + in_tile.xy * u_projection_tile_mercator_coords.zw;
```

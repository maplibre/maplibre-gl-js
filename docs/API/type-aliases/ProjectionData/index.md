# ProjectionData\<MainMatrix *extends* `mat4` = `mat4`, FallbackMatrix *extends* `mat4` = `MainMatrix`\>

> **ProjectionData**\<`MainMatrix` *extends* `mat4` = `mat4`, `FallbackMatrix` *extends* `mat4` = `MainMatrix`\> = `object`

Defined in: [geo/projection/projection\_data.ts:27](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L27>)

This type contains all data necessary to project a tile to screen in MapLibre's shader system. Contains data used for both mercator and globe projection.

## Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `MainMatrix` *extends* `mat4` | `mat4` |
| `FallbackMatrix` *extends* `mat4` | `MainMatrix` |

## Properties

### clipAntimeridian

> **clipAntimeridian**: `boolean`

Defined in: [geo/projection/projection\_data.ts:85](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L85>)

Whether line fragments outside the tile's X extent should be discarded: true for the zoom 0 tile under globe projection, false otherwise. The z0 tile covers the whole world, so its buffer wraps around the planet onto the tile itself, drawing geometry near the antimeridian twice. Stencil clipping cannot remove this same-pixel overlap, so lines are clipped in the fragment shader instead (fills are clipped during subdivision). Uniform name: `u_projection_clip_antimeridian`.

---

### clippingPlane

> **clippingPlane**: \[`number`, `number`, `number`, `number`\]

Defined in: [geo/projection/projection\_data.ts:53](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L53>)

The plane equation for a plane that intersects the planet's horizon. Assumes the planet to be a unit sphere. Used by globe projection for clipping. Uniform name: `u_projection_clipping_plane`.

---

### fallbackMatrix

> **fallbackMatrix**: `FallbackMatrix`

Defined in: [geo/projection/projection\_data.ts:77](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L77>)

Fallback matrix that projects the current tile according to mercator projection. Used by globe projection to fall back to mercator projection in an animated way. Uniform name: `u_projection_fallback_matrix`.

---

### mainMatrix

> **mainMatrix**: `MainMatrix`

Defined in: [geo/projection/projection\_data.ts:33](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L33>)

The main projection matrix. For mercator projection, it usually projects in-tile coordinates 0..EXTENT to screen, for globe projection, it projects a unit sphere planet to screen. Uniform name: `u_projection_matrix`.

---

### projectionTransition

> **projectionTransition**: `number`

Defined in: [geo/projection/projection\_data.ts:71](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L71>)

A value in range 0..1 indicating interpolation between mercator (0) and globe (1) projections. Used by globe projection to hide projection transition at high zooms. Uniform name: `u_projection_transition`.

---

### tileMercatorCoords

> **tileMercatorCoords**: \[`number`, `number`, `number`, `number`\]

Defined in: [geo/projection/projection\_data.ts:46](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L46>)

The extent of current tile in the mercator square. Used by globe projection. First two components are X and Y offset, last two are X and Y scale. Uniform name: `u_projection_tile_mercator_coords`.

Conversion from in-tile coordinates in range 0..EXTENT is done as follows:

#### Example

```text
vec2 mercator_coords = u_projection_tile_mercator_coords.xy + in_tile.xy * u_projection_tile_mercator_coords.zw;
```

---

### tileOrigin

> **tileOrigin**: \[`number`, `number`, `number`, `number`\]

Defined in: [geo/projection/projection\_data.ts:60](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L60>)

The point on the unit sphere that `mainMatrix` projects positions relative to, as the sine and cosine of its longitude, `tan(PI / 4 + latitude / 2)` and 1. All zeros when positions are relative to the planet center. Used by globe projection, to keep float32 precision at high zoom. Uniform name: `u_projection_tile_origin`.

---

### tileOriginPosition

> **tileOriginPosition**: \[`number`, `number`\]

Defined in: [geo/projection/projection\_data.ts:65](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L65>)

Where `tileOrigin` lies in the tile, in tile units. It is the tile's point nearest the camera's center. Uniform name: `u_projection_tile_origin_position`.

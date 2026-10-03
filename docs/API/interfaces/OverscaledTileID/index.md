# OverscaledTileID

Defined in: [tile/tile\_id.ts:88](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile_id.ts#L88>)

An overscaled tile identifier

## Methods

### normalizeCoordinates()

> **normalizeCoordinates**(`x`: `number`, `y`: `number`, `extent?`: `number`): `object`

Defined in: [tile/tile\_id.ts:244](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile_id.ts#L244>)

Maps tile-local coordinates that may fall outside the `[0, extent)` range to the correct neighbor tile and the corresponding in-tile position.

Coordinates can exceed tile bounds when geometry (e.g. symbol labels along lines) extends across tile edges. This method resolves such coordinates to the appropriate adjacent tile, wrapping horizontally across world boundaries and returning `null` when the target falls beyond the polar tile-grid limits.

When the coordinates are already in bounds, the original tile ID is returned.

#### Parameters

| Parameter | Type | Default value | Description |
| --- | --- | --- | --- |
| `x` | `number` | `undefined` | x coordinate relative to this tile, may be outside `[0, extent)` |
| `y` | `number` | `undefined` | y coordinate relative to this tile, may be outside `[0, extent)` |
| `extent` | `number` | `EXTENT` | tile coordinate extent, default [EXTENT](<https://maplibre.org/maplibre-gl-js/docs/API/variables/EXTENT/index.md>) |

#### Returns

`object`

the resolved tile ID and in-tile coordinates, or `null` if the target is beyond the tile grid (e.g. past the poles)

##### tileID

> **tileID**: `OverscaledTileID`

##### x

> **x**: `number`

##### y

> **y**: `number`

---

### scaledTo()

> **scaledTo**(`targetZ`: `number`): `OverscaledTileID`

Defined in: [tile/tile\_id.ts:125](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile_id.ts#L125>)

Returns a new `OverscaledTileID` representing the tile at the target zoom level. When targetZ is greater than the current canonical z, the canonical coordinates are unchanged. When targetZ is less than the current canonical z, the canonical coordinates are updated.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `targetZ` | `number` | the zoom level to scale to. Must be less than or equal to this.overscaledZ |

#### Returns

`OverscaledTileID`

a new OverscaledTileID representing the tile at the target zoom level

#### Throws

if targetZ is greater than this.overscaledZ

## Properties

### terrainRttPosMatrix32f

> **terrainRttPosMatrix32f**: [`Mat4f32`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Mat4f32/index.md>) = `null`

Defined in: [tile/tile\_id.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile_id.ts#L99>)

This matrix is used during terrain's render-to-texture stage only. If the render-to-texture stage is active, this matrix will be present and should be used, otherwise this matrix will be null. The matrix should be float32 in order to avoid slow WebGL calls in Chrome.

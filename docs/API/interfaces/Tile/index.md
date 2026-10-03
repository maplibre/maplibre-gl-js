# Tile

Defined in: [tile/tile.ts:70](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile.ts#L70>)

A tile object is the combination of a Coordinate, which defines its place, as well as a unique ID and data tracking for its content

## Methods

### isRenderable()

> **isRenderable**(`symbolLayer`: `boolean`): `boolean`

Defined in: [tile/tile.ts:170](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile.ts#L170>)

Incoming and self-fading raster tiles must remain renderable at zero opacity because drawing advances their opacity. Only transparent departing tiles have finished fading.

#### Parameters

| Parameter | Type |
| --- | --- |
| `symbolLayer` | `boolean` |

#### Returns

`boolean`

---

### loadVectorData()

> **loadVectorData**(`data`: `WorkerTileResult`, `painter`: `Painter`, `justReloaded?`: `boolean`): `void`

Defined in: [tile/tile.ts:260](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile.ts#L260>)

Given a data object with a 'buffers' property, load it into this tile's elementGroups and buffers properties and set loaded to true. If the data is null, like in the case of an empty GeoJSON tile, no-op but still set loaded to true.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `data` | `WorkerTileResult` | The data from the worker |
| `painter` | `Painter` | the painter |
| `justReloaded?` | `boolean` | `true` to just reload |

#### Returns

`void`

---

### setSelfFadeLogic()

> **setSelfFadeLogic**(`fadeEndTime`: `number`): `void`

Defined in: [tile/tile.ts:194](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile.ts#L194>)

Self fading for edge tiles (when panning map)

#### Parameters

| Parameter | Type |
| --- | --- |
| `fadeEndTime` | `number` |

#### Returns

`void`

---

### unloadVectorData()

> **unloadVectorData**(): `void`

Defined in: [tile/tile.ts:342](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/tile/tile.ts#L342>)

Release any data or WebGL resources referenced by this tile.

#### Returns

`void`

# Tile

Defined in: [tile/tile.ts:72](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/tile/tile.ts#L72>)

A tile object is the combination of a Coordinate, which defines its place, as well as a unique ID and data tracking for its content

## Methods

### isRenderable()

> **isRenderable**(`symbolLayer`: `boolean`): `boolean`

Defined in: [tile/tile.ts:172](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/tile/tile.ts#L172>)

Incoming and self-fading raster tiles must remain renderable at zero opacity because drawing advances their opacity. Only transparent departing tiles have finished fading.

#### Parameters

| Parameter | Type |
| --- | --- |
| `symbolLayer` | `boolean` |

#### Returns

`boolean`

---

### loadVectorData()

> **loadVectorData**(`data`: `WorkerTileResult`, `style`: [`Style`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Style/index.md>), `justReloaded?`: `boolean`): `void`

Defined in: [tile/tile.ts:273](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/tile/tile.ts#L273>)

Given a data object with a 'buffers' property, load it into this tile's elementGroups and buffers properties and set loaded to true. If the data is null, like in the case of an empty GeoJSON tile, no-op but still set loaded to true.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `data` | `WorkerTileResult` | The data from the worker |
| `style` | [`Style`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Style/index.md>) | the style the tile's layers belong to |
| `justReloaded?` | `boolean` | `true` to just reload |

#### Returns

`void`

---

### setSelfFadeLogic()

> **setSelfFadeLogic**(`fadeEndTime`: `number`): `void`

Defined in: [tile/tile.ts:196](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/tile/tile.ts#L196>)

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

Defined in: [tile/tile.ts:355](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/tile/tile.ts#L355>)

Release any data or WebGL resources referenced by this tile.

#### Returns

`void`

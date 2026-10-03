# Source

Defined in: [source/source.ts:31](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L31>)

The `Source` interface must be implemented by each source type, including "core" types (`vector`, `raster`, `video`, etc.) and all custom, third-party types.

**Event** `data` - Fired with `{dataType: 'source', sourceDataType: 'metadata'}` to indicate that any necessary metadata has been loaded so that it's okay to call `loadTile`; and with `{dataType: 'source', sourceDataType: 'content'}` to indicate that the source data has changed, so that any current caches should be flushed.

## Methods

### abortTile()?

> `optional` **abortTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/source.ts:105](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L105>)

Allows to abort a tile loading.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to abort |

#### Returns

`Promise`\<`void`\>

---

### fire()

> **fire**(`event`: [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)): `unknown`

Defined in: [source/source.ts:79](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L79>)

An ability to fire an event to all the listeners, see [Evented](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `event` | [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>) | The event to fire |

#### Returns

`unknown`

---

### hasTile()?

> `optional` **hasTile**(`tileID`: [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>)): `boolean`

Defined in: [source/source.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L100>)

True is the tile is part of the source, false otherwise.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tileID` | [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>) | The tile ID |

#### Returns

`boolean`

---

### hasTransition()

> **hasTransition**(): `boolean`

Defined in: [source/source.ts:70](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L70>)

True if the source has transition, false otherwise.

#### Returns

`boolean`

---

### loaded()

> **loaded**(): `boolean`

Defined in: [source/source.ts:74](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L74>)

True if the source is loaded, false otherwise.

#### Returns

`boolean`

---

### loadTile()

> **loadTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void` | `LoadTileResult`\>

Defined in: [source/source.ts:95](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L95>)

This method does the heavy lifting of loading a tile. In most cases it will defer the work to the relevant worker source.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to load |

#### Returns

`Promise`\<`void` | `LoadTileResult`\>

---

### onAdd()?

> `optional` **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `void`

Defined in: [source/source.ts:84](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L84>)

This method is called when the source is added to the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The map instance |

#### Returns

`void`

---

### onRemove()?

> `optional` **onRemove**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `void`

Defined in: [source/source.ts:89](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L89>)

This method is called when the source is removed from the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The map instance |

#### Returns

`void`

---

### prepare()?

> `optional` **prepare**(): `void`

Defined in: [source/source.ts:120](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L120>)

Allows to execute a prepare step before the source is used.

#### Returns

`void`

---

### serialize()

> **serialize**(): `any`

Defined in: [source/source.ts:116](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L116>)

#### Returns

`any`

A plain (stringifiable) JS object representing the current state of the source. Creating a source using the returned object as the `options` should result in a Source that is equivalent to this one.

---

### unloadTile()?

> `optional` **unloadTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/source.ts:110](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L110>)

Allows to unload a tile.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to unload |

#### Returns

`Promise`\<`void`\>

## Properties

### attribution?

> `optional` **attribution?**: `string`

Defined in: [source/source.ts:52](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L52>)

The attribution for the source.

---

### calculateTileZoom?

> `optional` **calculateTileZoom?**: [`CalculateTileZoomFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CalculateTileZoomFunction/index.md>)

Defined in: [source/source.ts:124](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L124>)

Optional function to redefine how tiles are loaded at high pitch angles.

---

### id

> **id**: `string`

Defined in: [source/source.ts:36](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L36>)

The id for the source. Must not be used by any existing source.

---

### isTileClipped?

> `optional` **isTileClipped?**: `boolean`

Defined in: [source/source.ts:60](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L60>)

`false` if tiles can be drawn outside their boundaries, `true` if they cannot.

---

### maxzoom

> **maxzoom**: `number`

Defined in: [source/source.ts:44](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L44>)

The maximum zoom level for the source.

---

### minzoom

> **minzoom**: `number`

Defined in: [source/source.ts:40](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L40>)

The minimum zoom level for the source.

---

### reparseOverscaled?

> `optional` **reparseOverscaled?**: `boolean`

Defined in: [source/source.ts:65](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L65>)

`true` if tiles should be sent back to the worker for each overzoomed zoom level, `false` if not.

---

### roundZoom?

> `optional` **roundZoom?**: `boolean`

Defined in: [source/source.ts:56](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L56>)

`true` if zoom levels are rounded to the nearest integer in the source data, `false` if they are floor-ed to the nearest integer.

---

### tileSize

> **tileSize**: `number`

Defined in: [source/source.ts:48](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/source.ts#L48>)

The tile size for the source.

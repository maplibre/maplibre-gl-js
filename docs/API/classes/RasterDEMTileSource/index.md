# RasterDEMTileSource

Defined in: [source/raster\_dem\_tile\_source.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_dem_tile_source.ts#L37>)

A source containing raster DEM tiles (See the [Style Specification](<https://maplibre.org/maplibre-style-spec/>) for detailed documentation of options.) This source can be used to show hillshading and 3D terrain

## Example

```ts
map.addSource('raster-dem-source', {
     type: 'raster-dem',
     url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
     tileSize: 256
});
```

## See

[3D Terrain](<https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/>)

## Extends

- [`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>)

## Implements

- [`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>)

## Methods

### abortTile()

> **abortTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/raster\_tile\_source.ts:254](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L254>)

Allows to abort a tile loading.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to abort |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`abortTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#aborttile>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`abortTile`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#aborttile>)

---

### fire()

#### Call Signature

> **fire**(`event`: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) | [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) \| [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) |

##### Returns

`this`

##### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#fire>)

##### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#fire>)

#### Call Signature

> **fire**(`type`: keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Implementation of

`Source.fire`

##### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#fire>)

---

### hasTile()

> **hasTile**(`tileID`: [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>)): `boolean`

Defined in: [source/raster\_tile\_source.ts:201](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L201>)

True is the tile is part of the source, false otherwise.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tileID` | [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>) | The tile ID |

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`hasTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#hastile>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`hasTile`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#hastile>)

---

### hasTransition()

> **hasTransition**(): `boolean`

Defined in: [source/raster\_tile\_source.ts:267](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L267>)

True if the source has transition, false otherwise.

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`hasTransition`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#hastransition>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`hasTransition`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#hastransition>)

---

### listens()

> **listens**(`type`: keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#listens>)

---

### loaded()

> **loaded**(): `boolean`

Defined in: [source/raster\_tile\_source.ts:122](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L122>)

True if the source is loaded, false otherwise.

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`loaded`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#loaded>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`loaded`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#loaded>)

---

### off()

> **off**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L117>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#off>)

---

### on()

> **on**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L100>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#on>)

---

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `void`

Defined in: [source/raster\_tile\_source.ts:126](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L126>)

This method is called when the source is added to the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The map instance |

#### Returns

`void`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`onAdd`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#onadd>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`onAdd`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#onadd>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`): `Promise`\<[`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L132>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<[`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L142>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#once>)

---

### onRemove()

> **onRemove**(): `void`

Defined in: [source/raster\_tile\_source.ts:131](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L131>)

This method is called when the source is removed from the map.

#### Returns

`void`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#onremove>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#onremove>)

---

### serialize()

> **serialize**(): `RasterSourceSpecification` | `RasterDEMSourceSpecification`

Defined in: [source/raster\_tile\_source.ts:177](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L177>)

#### Returns

`RasterSourceSpecification` | `RasterDEMSourceSpecification`

A plain (stringifiable) JS object representing the current state of the source. Creating a source using the returned object as the `options` should result in a Source that is equivalent to this one.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`serialize`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#serialize>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`serialize`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#serialize>)

---

### setEventedParent()

> **setEventedParent**(`parent?`: [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>, `data?`: [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) | (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>))): `this`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L217>)

Bubble all events fired by this instance of Evented to this parent instance of Evented.

#### Parameters

| Parameter | Type |
| --- | --- |
| `parent?` | [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\> |
| `data?` | [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) \| (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>)) |

#### Returns

`this`

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`setEventedParent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#seteventedparent>)

---

### setPremultiplyAlpha()

> **setPremultiplyAlpha**(`premultiplyAlpha`: `boolean`): `this`

Defined in: [source/raster\_tile\_source.ts:191](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L191>)

Sets whether alpha premultiplication is applied to raster tile images. Set to `false` to preserve exact RGBA byte values when alpha carries data instead of opacity.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `premultiplyAlpha` | `boolean` | If `false`, disables alpha premultiplication for raster tile image decode and texture upload. |

#### Returns

`this`

#### Example

```ts
map.getSource<RasterTileSource>('raster-source').setPremultiplyAlpha(false);
```

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`setPremultiplyAlpha`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#setpremultiplyalpha>)

---

### setTiles()

> **setTiles**(`tiles`: `string`\[\]): `this`

Defined in: [source/raster\_tile\_source.ts:154](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L154>)

Sets the source `tiles` property and re-renders the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tiles` | `string`\[\] | An array of one or more tile source URLs, as in the raster tiles spec (See the [Style Specification](<https://maplibre.org/maplibre-style-spec/>) |

#### Returns

`this`

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`setTiles`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#settiles>)

---

### setUrl()

> **setUrl**(`url`: `string`): `this`

Defined in: [source/raster\_tile\_source.ts:168](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L168>)

Sets the source `url` property and re-renders the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `url` | `string` | A URL to a TileJSON resource. Supported protocols are `http:` and `https:`. |

#### Returns

`this`

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`setUrl`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#seturl>)

## Properties

### id

> **id**: `string`

Defined in: [source/raster\_tile\_source.ts:55](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L55>)

The id for the source. Must not be used by any existing source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`id`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#id>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`id`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#id>)

---

### maxzoom

> **maxzoom**: `number`

Defined in: [source/raster\_tile\_source.ts:57](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L57>)

The maximum zoom level for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`maxzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#maxzoom>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`maxzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#maxzoom>)

---

### minzoom

> **minzoom**: `number`

Defined in: [source/raster\_tile\_source.ts:56](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L56>)

The minimum zoom level for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`minzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#minzoom>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`minzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#minzoom>)

---

### roundZoom

> **roundZoom**: `boolean`

Defined in: [source/raster\_tile\_source.ts:64](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L64>)

`true` if zoom levels are rounded to the nearest integer in the source data, `false` if they are floor-ed to the nearest integer.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`roundZoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#roundzoom>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`roundZoom`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#roundzoom>)

---

### tileSize

> **tileSize**: `number`

Defined in: [source/raster\_tile\_source.ts:60](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/raster_tile_source.ts#L60>)

The tile size for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`tileSize`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#tilesize>)

#### Inherited from

[`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>).[`tileSize`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/#tilesize>)

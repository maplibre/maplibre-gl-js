# VectorTileSource

Defined in: [source/vector\_tile\_source.ts:65](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L65>)

A source containing vector tiles in [Maplibre Vector Tile format](<https://maplibre.org/maplibre-tile-spec/>) or [Mapbox Vector Tile format](<https://docs.mapbox.com/vector-tiles/reference/>). (See the [Style Specification](<https://maplibre.org/maplibre-style-spec/>) for detailed documentation of options.)

## Examples

```ts
map.addSource('some id', {
    type: 'vector',
    url: 'https://demotiles.maplibre.org/tiles/tiles.json'
});
```

```ts
map.addSource('some id', {
    type: 'vector',
    tiles: ['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt'],
    minzoom: 6,
    maxzoom: 14
});
```

```ts
map.getSource('some id').setUrl("https://demotiles.maplibre.org/tiles/tiles.json");
```

```ts
map.getSource('some id').setTiles(['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt']);
```

## See

[Add a vector tile source](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-vector-tile-source/>)

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>

## Implements

- [`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>)

## Methods

### abortTile()

> **abortTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/vector\_tile\_source.ts:302](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L302>)

Allows to abort a tile loading.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to abort |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`abortTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#aborttile>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### hasTile()

> **hasTile**(`tileID`: [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>)): `boolean`

Defined in: [source/vector\_tile\_source.ts:147](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L147>)

True is the tile is part of the source, false otherwise.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tileID` | [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>) | The tile ID |

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`hasTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#hastile>)

---

### hasTransition()

> **hasTransition**(): `boolean`

Defined in: [source/vector\_tile\_source.ts:328](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L328>)

True if the source has transition, false otherwise.

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`hasTransition`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#hastransition>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### loaded()

> **loaded**(): `boolean`

Defined in: [source/vector\_tile\_source.ts:143](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L143>)

True if the source is loaded, false otherwise.

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`loaded`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#loaded>)

---

### loadTile()

> **loadTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void` | `LoadTileResult`\>

Defined in: [source/vector\_tile\_source.ts:205](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L205>)

This method does the heavy lifting of loading a tile. In most cases it will defer the work to the relevant worker source.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to load |

#### Returns

`Promise`\<`void` | `LoadTileResult`\>

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`loadTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#loadtile>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

---

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `void`

Defined in: [source/vector\_tile\_source.ts:151](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L151>)

This method is called when the source is added to the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The map instance |

#### Returns

`void`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`onAdd`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#onadd>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

---

### onRemove()

> **onRemove**(): `void`

Defined in: [source/vector\_tile\_source.ts:194](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L194>)

This method is called when the source is removed from the map.

#### Returns

`void`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#onremove>)

---

### serialize()

> **serialize**(): `VectorSourceSpecification`

Defined in: [source/vector\_tile\_source.ts:201](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L201>)

#### Returns

`VectorSourceSpecification`

A plain (stringifiable) JS object representing the current state of the source. Creating a source using the returned object as the `options` should result in a Source that is equivalent to this one.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`serialize`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#serialize>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`setEventedParent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#seteventedparent>)

---

### setTiles()

> **setTiles**(`tiles`: `string`\[\]): `this`

Defined in: [source/vector\_tile\_source.ts:171](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L171>)

Sets the source `tiles` property and re-renders the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tiles` | `string`\[\] | An array of one or more tile source URLs, as in the TileJSON spec. |

#### Returns

`this`

---

### setUrl()

> **setUrl**(`url`: `string`): `this`

Defined in: [source/vector\_tile\_source.ts:185](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L185>)

Sets the source `url` property and re-renders the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `url` | `string` | A URL to a TileJSON resource. Supported protocols are `http:` and `https:`. |

#### Returns

`this`

---

### unloadTile()

> **unloadTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/vector\_tile\_source.ts:315](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L315>)

Allows to unload a tile.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to unload |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`unloadTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#unloadtile>)

## Properties

### id

> **id**: `string`

Defined in: [source/vector\_tile\_source.ts:67](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L67>)

The id for the source. Must not be used by any existing source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`id`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#id>)

---

### isTileClipped

> **isTileClipped**: `boolean`

Defined in: [source/vector\_tile\_source.ts:84](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L84>)

`false` if tiles can be drawn outside their boundaries, `true` if they cannot.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`isTileClipped`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#istileclipped>)

---

### maxzoom

> **maxzoom**: `number`

Defined in: [source/vector\_tile\_source.ts:69](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L69>)

The maximum zoom level for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`maxzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#maxzoom>)

---

### minzoom

> **minzoom**: `number`

Defined in: [source/vector\_tile\_source.ts:68](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L68>)

The minimum zoom level for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`minzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#minzoom>)

---

### reparseOverscaled

> **reparseOverscaled**: `boolean`

Defined in: [source/vector\_tile\_source.ts:83](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L83>)

`true` if tiles should be sent back to the worker for each overzoomed zoom level, `false` if not.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`reparseOverscaled`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#reparseoverscaled>)

---

### tileSize

> **tileSize**: `number`

Defined in: [source/vector\_tile\_source.ts:73](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/vector_tile_source.ts#L73>)

The tile size for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`tileSize`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#tilesize>)

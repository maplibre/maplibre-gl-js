# CanvasSource

Defined in: [source/canvas\_source.ts:66](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/canvas_source.ts#L66>)

A data source containing the contents of an HTML canvas. See [CanvasSourceSpecification](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CanvasSourceSpecification/index.md>) for detailed documentation of options.

## Example

```ts
// add to map
map.addSource('some id', {
   type: 'canvas',
   canvas: 'idOfMyHTMLCanvas',
   animate: true,
   coordinates: [
       [-76.54, 39.18],
       [-76.52, 39.18],
       [-76.52, 39.17],
       [-76.54, 39.17]
   ]
});

// update
let mySource = map.getSource('some id');
mySource.setCoordinates([
    [-76.54335737228394, 39.18579907229748],
    [-76.52803659439087, 39.1838364847587],
    [-76.5295386314392, 39.17683392507606],
    [-76.54520273208618, 39.17876344106642]
]);

map.removeSource('some id');  // remove
```

## Extends

- [`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>)

## Methods

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

##### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#fire>)

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

##### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#fire>)

---

### getCanvas()

> **getCanvas**(): `HTMLCanvasElement`

Defined in: [source/canvas\_source.ts:143](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/canvas_source.ts#L143>)

Returns the HTML `canvas` element.

#### Returns

`HTMLCanvasElement`

The HTML `canvas` element.

---

### getWarp()

> **getWarp**(): [`ImageSourceWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>)

Defined in: [source/image\_source.ts:411](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L411>)

**`Experimental`**

Returns how the image is warped onto its coordinates.

#### Returns

[`ImageSourceWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>)

The warp in use, see [ImageSourceWarp](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>).

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`getWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#getwarp>)

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

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#listens>)

---

### loaded()

> **loaded**(): `boolean`

Defined in: [source/image\_source.ts:279](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L279>)

True if the source is loaded, false otherwise.

#### Returns

`boolean`

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`loaded`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#loaded>)

---

### loadTile()

> **loadTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/image\_source.ts:492](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L492>)

This method does the heavy lifting of loading a tile. In most cases it will defer the work to the relevant worker source.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to load |

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`loadTile`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#loadtile>)

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

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#off>)

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

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#on>)

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

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#once>)

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

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#once>)

---

### setCoordinates()

> **setCoordinates**(`coordinates`: [`Coordinates`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Coordinates/index.md>)): `this`

Defined in: [source/image\_source.ts:423](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L423>)

Sets the image's coordinates and re-renders the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `coordinates` | [`Coordinates`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Coordinates/index.md>) | Four geographical coordinates, represented as arrays of longitude and latitude numbers, which define the corners of the image. The coordinates start at the top left corner of the image and proceed in clockwise order. They do not have to represent a rectangle. |

#### Returns

`this`

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`setCoordinates`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#setcoordinates>)

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

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`setEventedParent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#seteventedparent>)

---

### setWarp()

> **setWarp**(`warp`: [`ImageSourceWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>)): `this`

Defined in: [source/image\_source.ts:394](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L394>)

**`Experimental`**

Sets how the image is warped onto its coordinates and re-renders the map.

This only has an effect while the coordinates do not form a rectangle, and it is not part of the style specification, so it does not survive `map.setStyle`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `warp` | [`ImageSourceWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>) | The warp to use, see [ImageSourceWarp](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>). |

#### Returns

`this`

#### Example

```ts
// Keep the image pinned to its corners while the user drags them around.
map.getSource('some id').setWarp('flat');
```

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`setWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#setwarp>)

---

### updateImage()

> **updateImage**(`options`: [`UpdateImageOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/UpdateImageOptions/index.md>)): `this`

Defined in: [source/image\_source.ts:293](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L293>)

Updates the image and, optionally, the coordinates. To avoid having the image flash after changing, set the `raster-fade-duration` paint property on the raster layer to 0.

Provide exactly one of `url` (to fetch a new image over the network) or `image` (an already-decoded `HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap` or `ImageData` to display directly, without a network request).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`UpdateImageOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/UpdateImageOptions/index.md>) | The options object. |

#### Returns

`this`

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`updateImage`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#updateimage>)

## Properties

### id

> **id**: `string`

Defined in: [source/image\_source.ts:190](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L190>)

The id for the source. Must not be used by any existing source.

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`id`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#id>)

---

### maxzoom

> **maxzoom**: `number`

Defined in: [source/image\_source.ts:192](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L192>)

The maximum zoom level for the source.

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`maxzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#maxzoom>)

---

### minzoom

> **minzoom**: `number`

Defined in: [source/image\_source.ts:191](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L191>)

The minimum zoom level for the source.

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`minzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#minzoom>)

---

### pause

> **pause**: () =\> `void`

Defined in: [source/canvas\_source.ts:79](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/canvas_source.ts#L79>)

Disables animation. The map will display a static copy of the canvas image.

#### Returns

`void`

---

### play

> **play**: () =\> `void`

Defined in: [source/canvas\_source.ts:75](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/canvas_source.ts#L75>)

Enables animation. The image will be copied from the canvas to the map on each frame.

#### Returns

`void`

---

### terrainTileRanges

> **terrainTileRanges**: `object`

Defined in: [source/image\_source.ts:199](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L199>)

This object is used to store the range of terrain tiles that overlap with this tile. It is relevant for image tiles, as the image exceeds single tile boundaries.

#### Index Signature

\[`zoom`: `string`\]: `CanonicalTileRange`

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`terrainTileRanges`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#terraintileranges>)

---

### tileSize

> **tileSize**: `number`

Defined in: [source/image\_source.ts:193](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/source/image_source.ts#L193>)

The tile size for the source.

#### Inherited from

[`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>).[`tileSize`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#tilesize>)

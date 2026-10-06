# ImageSource

Defined in: [source/image\_source.ts:188](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L188>)

A data source containing an image. (See the [Style Specification](<https://maplibre.org/maplibre-style-spec/#sources-image>) for detailed documentation of options.)

## Example

```ts
// add to map
map.addSource('some id', {
   type: 'image',
   url: 'https://www.maplibre.org/images/foo.png',
   coordinates: [
       [-76.54, 39.18],
       [-76.52, 39.18],
       [-76.52, 39.17],
       [-76.54, 39.17]
   ]
});

// update coordinates
let mySource = map.getSource('some id');
mySource.setCoordinates([
    [-76.54335737228394, 39.18579907229748],
    [-76.52803659439087, 39.1838364847587],
    [-76.5295386314392, 39.17683392507606],
    [-76.54520273208618, 39.17876344106642]
]);

// update url and coordinates simultaneously
mySource.updateImage({
   url: 'https://www.maplibre.org/images/bar.png',
   coordinates: [
       [-76.54335737228394, 39.18579907229748],
       [-76.52803659439087, 39.1838364847587],
       [-76.5295386314392, 39.17683392507606],
       [-76.54520273208618, 39.17876344106642]
   ]
})

// update with an already-decoded image (no network request)
const bitmap = await createImageBitmap(myCanvas);
mySource.updateImage({image: bitmap});

// create an empty source (no url), then feed it entirely via updateImage
map.addSource('empty id', {
   type: 'image',
   coordinates: [
       [-76.54, 39.18],
       [-76.52, 39.18],
       [-76.52, 39.17],
       [-76.54, 39.17]
   ]
});
(map.getSource('empty id') as ImageSource).updateImage({image: bitmap});

map.removeSource('some id');  // remove
```

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>

## Extended by

- [`CanvasSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/CanvasSource/index.md>)
- [`VideoSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/VideoSource/index.md>)

## Implements

- [`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>)

## Methods

### fire()

#### Call Signature

> **fire**(`event`: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) | [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L156>)

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

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L162>)

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

### getWarp()

> **getWarp**(): [`ImageSourceWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>)

Defined in: [source/image\_source.ts:411](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L411>)

**`Experimental`**

Returns how the image is warped onto its coordinates.

#### Returns

[`ImageSourceWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>)

The warp in use, see [ImageSourceWarp](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>).

---

### hasTransition()

> **hasTransition**(): `boolean`

Defined in: [source/image\_source.ts:518](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L518>)

True if the source has transition, false otherwise.

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`hasTransition`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#hastransition>)

---

### listens()

> **listens**(`type`: keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L206>)

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

Defined in: [source/image\_source.ts:279](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L279>)

True if the source is loaded, false otherwise.

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`loaded`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#loaded>)

---

### loadTile()

> **loadTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/image\_source.ts:492](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L492>)

This method does the heavy lifting of loading a tile. In most cases it will defer the work to the relevant worker source.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to load |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`loadTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#loadtile>)

---

### off()

> **off**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L117>)

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

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L100>)

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

Defined in: [source/image\_source.ts:362](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L362>)

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

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L132>)

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

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L142>)

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

Defined in: [source/image\_source.ts:367](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L367>)

This method is called when the source is removed from the map.

#### Returns

`void`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#onremove>)

---

### prepare()

> **prepare**(): `void`

Defined in: [source/image\_source.ts:460](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L460>)

Allows to execute a prepare step before the source is used.

#### Returns

`void`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`prepare`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#prepare>)

---

### serialize()

> **serialize**(): `VideoSourceSpecification` | `ImageSourceSpecification` | [`CanvasSourceSpecification`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CanvasSourceSpecification/index.md>)

Defined in: [source/image\_source.ts:507](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L507>)

#### Returns

`VideoSourceSpecification` | `ImageSourceSpecification` | [`CanvasSourceSpecification`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CanvasSourceSpecification/index.md>)

A plain (stringifiable) JS object representing the current state of the source. Creating a source using the returned object as the `options` should result in a Source that is equivalent to this one.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`serialize`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#serialize>)

---

### setCoordinates()

> **setCoordinates**(`coordinates`: [`Coordinates`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Coordinates/index.md>)): `this`

Defined in: [source/image\_source.ts:423](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L423>)

Sets the image's coordinates and re-renders the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `coordinates` | [`Coordinates`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Coordinates/index.md>) | Four geographical coordinates, represented as arrays of longitude and latitude numbers, which define the corners of the image. The coordinates start at the top left corner of the image and proceed in clockwise order. They do not have to represent a rectangle. |

#### Returns

`this`

---

### setEventedParent()

> **setEventedParent**(`parent?`: [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>, `data?`: [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) | (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>))): `this`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L217>)

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

### setWarp()

> **setWarp**(`warp`: [`ImageSourceWarp`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceWarp/index.md>)): `this`

Defined in: [source/image\_source.ts:394](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L394>)

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

---

### updateImage()

> **updateImage**(`options`: [`UpdateImageOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/UpdateImageOptions/index.md>)): `this`

Defined in: [source/image\_source.ts:293](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L293>)

Updates the image and, optionally, the coordinates. To avoid having the image flash after changing, set the `raster-fade-duration` paint property on the raster layer to 0.

Provide exactly one of `url` (to fetch a new image over the network) or `image` (an already-decoded `HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap` or `ImageData` to display directly, without a network request).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`UpdateImageOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/UpdateImageOptions/index.md>) | The options object. |

#### Returns

`this`

## Properties

### id

> **id**: `string`

Defined in: [source/image\_source.ts:190](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L190>)

The id for the source. Must not be used by any existing source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`id`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#id>)

---

### maxzoom

> **maxzoom**: `number`

Defined in: [source/image\_source.ts:192](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L192>)

The maximum zoom level for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`maxzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#maxzoom>)

---

### minzoom

> **minzoom**: `number`

Defined in: [source/image\_source.ts:191](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L191>)

The minimum zoom level for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`minzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#minzoom>)

---

### terrainTileRanges

> **terrainTileRanges**: `object`

Defined in: [source/image\_source.ts:199](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L199>)

This object is used to store the range of terrain tiles that overlap with this tile. It is relevant for image tiles, as the image exceeds single tile boundaries.

#### Index Signature

\[`zoom`: `string`\]: `CanonicalTileRange`

---

### tileSize

> **tileSize**: `number`

Defined in: [source/image\_source.ts:193](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L193>)

The tile size for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`tileSize`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#tilesize>)

# Style

Defined in: [style/style.ts:213](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L213>)

The Style base class

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>

## Methods

### \_getOperationsToPerform()

> **\_getOperationsToPerform**(`diff`: `DiffCommand`\[\]): `object`

Defined in: [style/style.ts:932](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L932>)

Translates a style diff into the calls that apply it to this style.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `diff` | `DiffCommand`\[\] | the operations produced by the style-spec diff algorithm |

#### Returns

`object`

the operations to run, and the names of the commands that are not supported

##### operations

> **operations**: (() =\> `void`)\[\]

###### Returns

`void`

##### unimplemented

> **unimplemented**: `string`\[\]

---

### \_load()

> **\_load**(`json`: `StyleSpecification`, `options`: [`StyleSwapOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSwapOptions/index.md>) & [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>), `previousStyle?`: `StyleSpecification`): `void`

Defined in: [style/style.ts:509](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L509>)

Loads a style. The global state is set first, since the projection and the layers read it. The projection is created before the sources, which read it as they are added, and the map migrates to it once the layers and the light exist, so `projectiontransition` handlers can read them.

#### Parameters

| Parameter | Type |
| --- | --- |
| `json` | `StyleSpecification` |
| `options` | [`StyleSwapOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSwapOptions/index.md>) & [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) |
| `previousStyle?` | `StyleSpecification` |

#### Returns

`void`

---

### \_markImagesChanged()

> **\_markImagesChanged**(`ids`: `string`\[\]): `void`

Defined in: [style/style.ts:1073](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1073>)

Queues the tiles that depend on these images to be reloaded on the next update, which is needed whenever an image appears, disappears or changes size.

#### Parameters

| Parameter | Type |
| --- | --- |
| `ids` | `string`\[\] |

#### Returns

`void`

---

### \_setGlobalStateValues()

> **\_setGlobalStateValues**(`values`: `Record`\<`string`, `any`\>): `void`

Defined in: [style/style.ts:385](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L385>)

Sets the keys in `values` that differ, keeping a copy of the state from before so readers transition from it.

#### Parameters

| Parameter | Type |
| --- | --- |
| `values` | `Record`\<`string`, `any`\> |

#### Returns

`void`

---

### addLayer()

> **addLayer**(`layerObject`: [`AddLayerObject`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddLayerObject/index.md>), `before?`: `string`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [style/style.ts:1180](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1180>)

Add a layer to the map style. The layer will be inserted before the layer with ID `before`, or appended if `before` is omitted.

A source given inline is added under the layer's ID and handed to `addSource` as it is, without being copied, because it can hold a DOM element such as the `canvas` of a canvas source. The layer is copied shallowly to point it at that ID, so the object the caller passed in is left as it was.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerObject` | [`AddLayerObject`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddLayerObject/index.md>) | The style layer to add. |
| `before?` | `string` | ID of an existing layer to insert before |
| `options?` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | Style setter options. |

#### Returns

`this`

---

### addSprite()

> **addSprite**(`id`: `string`, `url`: `string`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>), `completion?`: (`err`: `Error`) =\> `void`): `void`

Defined in: [style/style.ts:2118](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L2118>)

Add a sprite.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The id of the desired sprite |
| `url` | `string` | The url to load the desired sprite from |
| `options?` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | The style setter options |
| `completion?` | (`err`: `Error`) =\> `void` | The completion handler |

#### Returns

`void`

---

### destroy()

> **destroy**(): `void`

Defined in: [style/style.ts:2198](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L2198>)

Destroys all internal resources of the style (sources, images, layers, etc.)

#### Returns

`void`

---

### fire()

#### Call Signature

> **fire**(`event`: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) | [`MapStyleImageMissingEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>) | [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`unknown`\> | [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) | [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>) | [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>) | [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>) | [`MapStyleLoadEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>) | [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>) | [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>) | [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>) | [`MapWheelEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>) | [`MapTerrainEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>) | [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`TouchEvent` | `WheelEvent`\> & `object` | [`MapProjectionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>)): `this`

Defined in: [util/evented.ts:167](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L167>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) \| [`MapStyleImageMissingEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>) \| [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`unknown`\> \| [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) \| [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>) \| [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>) \| [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>) \| [`MapStyleLoadEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>) \| [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>) \| [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>) \| [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>) \| [`MapWheelEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>) \| [`MapTerrainEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>) \| [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`TouchEvent` \| `WheelEvent`\> & `object` \| [`MapProjectionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#fire>)

#### Call Signature

> **fire**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:173](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L173>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#fire>)

---

### getFilter()

> **getFilter**(`layer`: `string`): `void` | `FilterSpecification`

Defined in: [style/style.ts:1403](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1403>)

Get a layer's filter object

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layer` | `string` | the layer to inspect |

#### Returns

`void` | `FilterSpecification`

the layer's filter, if any

---

### getLayer()

> **getLayer**(`id`: `string`): [`StyleLayer`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/StyleLayer/index.md>)

Defined in: [style/style.ts:1328](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1328>)

Return the style layer object with the given `id`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | id of the desired layer |

#### Returns

[`StyleLayer`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/StyleLayer/index.md>)

a layer, if one with the given `id` exists

---

### getLayersOrder()

> **getLayersOrder**(): `string`\[\]

Defined in: [style/style.ts:1337](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1337>)

Return the ids of all layers currently in the style, including custom layers, in order.

#### Returns

`string`\[\]

ids of layers, in order

---

### getLayoutProperty()

> **getLayoutProperty**\<`K` *extends* keyof `AllLayoutProperties`\>(`layerId`: `string`, `name`: `K`): `AllLayoutProperties`\[`K`\]

Defined in: [style/style.ts:1428](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1428>)

Get a layout property's value from a given layer

#### Type Parameters

| Type Parameter |
| --- |
| `K` *extends* keyof `AllLayoutProperties` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerId` | `string` | the layer to inspect |
| `name` | `K` | the name of the layout property |

#### Returns

`AllLayoutProperties`\[`K`\]

the property value

---

### getSource()

> **getSource**(`id`: `string`): [`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>)

Defined in: [style/style.ts:1165](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1165>)

Get a source by ID.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | ID of the desired source |

#### Returns

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>)

source

---

### getSprite()

> **getSprite**(): `object`\[\]

Defined in: [style/style.ts:2165](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L2165>)

Get the current sprite value.

#### Returns

`object`\[\]

empty array when no sprite is set; id-url pairs otherwise

---

### hasLayer()

> **hasLayer**(`id`: `string`): `boolean`

Defined in: [style/style.ts:1347](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1347>)

Checks if a specific layer is present within the style.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | the id of the desired layer |

#### Returns

`boolean`

a boolean specifying if the given layer is present

---

### listens()

> **listens**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L217>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#listens>)

---

### moveLayer()

> **moveLayer**(`id`: `string`, `before?`: `string`): `void`

Defined in: [style/style.ts:1254](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1254>)

Moves a layer to a different z-position. The layer will be inserted before the layer with ID `before`, or appended if `before` is omitted.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | ID of the layer to move |
| `before?` | `string` | ID of an existing layer to insert before |

#### Returns

`void`

---

### off()

> **off**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:128](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L128>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#off>)

---

### on()

> **on**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:111](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L111>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#on>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`): `Promise`\<[`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:143](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L143>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<[`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:153](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L153>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#once>)

---

### removeLayer()

> **removeLayer**(`id`: `string`): `void`

Defined in: [style/style.ts:1288](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1288>)

Remove the layer with the given id from the style. A [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) event will be fired if no such layer exists.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | id of the layer to remove |

#### Returns

`void`

---

### removeSource()

> **removeSource**(`id`: `string`): `this`

Defined in: [style/style.ts:1123](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1123>)

Remove a source from this stylesheet, given its id.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | id of the source to remove |

#### Returns

`this`

#### Throws

if no source is found with the given ID

---

### removeSprite()

> **removeSprite**(`id`: `string`): `void`

Defined in: [style/style.ts:2139](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L2139>)

Remove a sprite by its id. When the last sprite is removed, the whole `this.stylesheet.sprite` object becomes `undefined`. This falsy `undefined` value later prevents attempts to load the sprite when it's absent.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | the id of the sprite to remove |

#### Returns

`void`

---

### resize()

> **resize**(): `void`

Defined in: [style/style.ts:862](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L862>)

Tells the layers that the canvas was resized.

#### Returns

`void`

---

### setEventedParent()

> **setEventedParent**(`parent?`: [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>, `data?`: [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) | (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>))): `this`

Defined in: [util/evented.ts:228](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L228>)

Bubble all events fired by this instance of Evented to this parent instance of Evented.

#### Parameters

| Parameter | Type |
| --- | --- |
| `parent?` | [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\> |
| `data?` | [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) \| (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>)) |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`setEventedParent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#seteventedparent>)

---

### setGeoJSONSourceData()

> **setGeoJSONSourceData**(`id`: `string`, `data`: `string` | `GeoJSON`\<`Geometry`, {\[`name`: `string`\]: `any`; }\>): `void`

Defined in: [style/style.ts:1149](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1149>)

Set the data of a GeoJSON source, given its id.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | id of the source |
| `data` | `string` \| `GeoJSON`\<`Geometry`, {\[`name`: `string`\]: `any`; }\> | GeoJSON source |

#### Returns

`void`

---

### setSprite()

> **setSprite**(`sprite`: `SpriteSpecification`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>), `completion?`: (`err`: `Error`) =\> `void`): `void`

Defined in: [style/style.ts:2176](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L2176>)

Set a new value for the style's sprite.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `sprite` | `SpriteSpecification` | new sprite value |
| `options?` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | style setter options |
| `completion?` | (`err`: `Error`) =\> `void` | the completion handler |

#### Returns

`void`

---

### setState()

> **setState**(`nextState`: `StyleSpecification`, `options?`: [`StyleSwapOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSwapOptions/index.md>) & [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `boolean`

Defined in: [style/style.ts:890](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L890>)

Update this style's state to match the given style JSON, performing only the necessary mutations.

May throw an Error ('Unimplemented: METHOD') if the maplibre-gl-style-spec diff algorithm produces an operation that is not supported.

#### Parameters

| Parameter | Type |
| --- | --- |
| `nextState` | `StyleSpecification` |
| `options?` | [`StyleSwapOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSwapOptions/index.md>) & [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) |

#### Returns

`boolean`

true if any changes were made; false otherwise

---

### triggerSymbolPlacement()

> **triggerSymbolPlacement**(): `void`

Defined in: [style/style.ts:1934](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L1934>)

Re-places symbols on the next frame. Placement is skipped while its inputs look unchanged, so call this when something the map cannot see for itself has moved symbols.

#### Returns

`void`

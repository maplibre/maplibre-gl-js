# Evented\<EventType *extends* [`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>) = [`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>

Defined in: [util/evented.ts:86](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L86>)

Methods mixed in to other classes for event capabilities.

## Extended by

- [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)
- [`GeolocateControl`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/index.md>)
- [`FullscreenControl`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenControl/index.md>)
- [`Popup`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>)
- [`Marker`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/index.md>)
- [`Style`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Style/index.md>)
- [`GeoJSONSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/index.md>)
- [`ImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>)
- [`RasterTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/index.md>)
- [`VectorTileSource`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/VectorTileSource/index.md>)
- [`StyleLayer`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/StyleLayer/index.md>)
- [`Dispatcher`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Dispatcher/index.md>)

## Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `EventType` *extends* [`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>) | [`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>) |

## Methods

### fire()

#### Call Signature

> **fire**(`event`: `EventType`\[`Extract`\<keyof `EventType`, `string`\>\]): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | `EventType`\[`Extract`\<keyof `EventType`, `string`\>\] |

##### Returns

`this`

#### Call Signature

> **fire**(`type`: `Extract`\<keyof `EventType`\>, `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | `Extract`\<keyof `EventType`\> |
| `properties?` | `object` |

##### Returns

`this`

---

### listens()

> **listens**(`type`: `Extract`\<keyof `EventType`\>): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `Extract`\<keyof `EventType`\> | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

---

### off()

> **off**\<`T` *extends* `string`\>(`type`: `T`, `listener`: (`event`: `EventType`\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L117>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* `string` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: `EventType`\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

---

### on()

> **on**\<`T` *extends* `string`\>(`type`: `T`, `listener`: (`event`: `EventType`\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L100>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* `string` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: `EventType`\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* `string`\>(`type`: `T`): `Promise`\<`EventType`\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L132>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* `string` |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<`EventType`\[`T`\]\>

a promise that resolves with the event

#### Call Signature

> **once**\<`T` *extends* `string`\>(`type`: `T`, `listener`: (`event`: `EventType`\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L142>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* `string` |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: `EventType`\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

---

### setEventedParent()

> **setEventedParent**(`parent?`: `Evented`\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>, `data?`: [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) | (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>))): `this`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L217>)

Bubble all events fired by this instance of Evented to this parent instance of Evented.

#### Parameters

| Parameter | Type |
| --- | --- |
| `parent?` | `Evented`\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\> |
| `data?` | [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) \| (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>)) |

#### Returns

`this`

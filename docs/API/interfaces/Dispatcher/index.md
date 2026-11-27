# Dispatcher

Defined in: [util/dispatcher.ts:11](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/dispatcher.ts#L11>)

Responsible for sending messages from a [Source](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>) to an associated worker source (usually with the same name).

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\>

## Methods

### broadcast()

> **broadcast**\<`T` *extends* [`MessageType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>)\>(`type`: `T`, `data`: [`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`0`\]): `Promise`\<[`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`1`\]\[\]\>

Defined in: [util/dispatcher.ts:44](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/dispatcher.ts#L44>)

Broadcast a message to all Workers.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* [`MessageType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>) |

#### Parameters

| Parameter | Type |
| --- | --- |
| `type` | `T` |
| `data` | [`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`0`\] |

#### Returns

`Promise`\<[`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`1`\]\[\]\>

---

### fire()

#### Call Signature

> **fire**(`event`: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>)): `this`

Defined in: [util/evented.ts:167](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L167>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#fire>)

#### Call Signature

> **fire**(`type`: `"error"`, `properties?`: `object`): `this`

Defined in: [util/evented.ts:173](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L173>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | `"error"` |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#fire>)

---

### getActor()

> **getActor**(): `Promise`\<[`Actor`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Actor/index.md>)\>

Defined in: [util/dispatcher.ts:53](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/dispatcher.ts#L53>)

Acquires an actor to dispatch messages to. The actors are distributed in round-robin fashion.

#### Returns

`Promise`\<[`Actor`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Actor/index.md>)\>

An actor object backed by a web worker for processing messages.

---

### listens()

> **listens**(`type`: `"error"`): `boolean`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L217>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `"error"` | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#listens>)

---

### off()

> **off**\<`T` *extends* `"error"`\>(`type`: `T`, `listener`: (`event`: [`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:128](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L128>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* `"error"` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: [`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#off>)

---

### on()

> **on**\<`T` *extends* `"error"`\>(`type`: `T`, `listener`: (`event`: [`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:111](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L111>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* `"error"` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: [`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#on>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* `"error"`\>(`type`: `T`): `Promise`\<[`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:143](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L143>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* `"error"` |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<[`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#once>)

#### Call Signature

> **once**\<`T` *extends* `"error"`\>(`type`: `T`, `listener`: (`event`: [`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:153](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/evented.ts#L153>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* `"error"` |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: [`ErrorEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ErrorEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md#once>)

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

# GlobalDispatcher

Defined in: [util/global\_dispatcher.ts:51](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L51>)

The dispatcher shared across all map instances, see [getGlobalDispatcher](<https://maplibre.org/maplibre-gl-js/docs/API/functions/getGlobalDispatcher/index.md>). Unlike a map's dispatcher it never claims the workers: it builds actors for whichever workers the pool is running, and discards them when the pool terminates those workers.

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<`GlobalDispatcherEventType`\>

## Methods

### broadcast()

#### Call Signature

> **broadcast**\<`T` *extends* [`MessageType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>)\>(`type`: `T`, `data`: [`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`0`\]): `Promise`\<[`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`1`\]\[\]\>

Defined in: [util/global\_dispatcher.ts:143](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L143>)

Broadcast a message to all Workers. The type can be any string, to allow sending messages that are handled by a script that was imported using [importScriptInWorkers](<https://maplibre.org/maplibre-gl-js/docs/API/functions/importScriptInWorkers/index.md>).

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* [`MessageType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>) |

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | `T` |
| `data` | [`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`0`\] |

##### Returns

`Promise`\<[`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`1`\]\[\]\>

#### Call Signature

> **broadcast**\<`TData` = `any`, `TResult` = `any`\>(`type`: `string`, `data`: `TData`): `Promise`\<`TResult`\[\]\>

Defined in: [util/global\_dispatcher.ts:144](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L144>)

Broadcast a message to all Workers. The type can be any string, to allow sending messages that are handled by a script that was imported using [importScriptInWorkers](<https://maplibre.org/maplibre-gl-js/docs/API/functions/importScriptInWorkers/index.md>).

##### Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `TData` | `any` |
| `TResult` | `any` |

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | `string` |
| `data` | `TData` |

##### Returns

`Promise`\<`TResult`\[\]\>

---

### ensureWorkers()

> **ensureWorkers**(): `Promise`\<`void`\>

Defined in: [util/global\_dispatcher.ts:201](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L201>)

Restarts the workers if they don't answer a ping, for apps that learn of a return to the foreground some other way. Calls made while a check is running share that check.

#### Returns

`Promise`\<`void`\>

---

### fire()

#### Call Signature

> **fire**(`event`: [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)\<`string`\> | [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`Event`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>)\<`string`\> \| [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

#### Call Signature

> **fire**(`type`: keyof `GlobalDispatcherEventType`, `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof `GlobalDispatcherEventType` |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### importScript()

> **importScript**(`workerUrl`: `string`): `Promise`\<`void`\>

Defined in: [util/global\_dispatcher.ts:178](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L178>)

See [importScriptInWorkers](<https://maplibre.org/maplibre-gl-js/docs/API/functions/importScriptInWorkers/index.md>). A url may be broadcast more than once, e.g. when this call is what creates the workers; the worker runs each url only once.

#### Parameters

| Parameter | Type |
| --- | --- |
| `workerUrl` | `string` |

#### Returns

`Promise`\<`void`\>

---

### listens()

> **listens**(`type`: keyof `GlobalDispatcherEventType`): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof `GlobalDispatcherEventType` | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### off()

> **off**\<`T` *extends* keyof `GlobalDispatcherEventType`\>(`type`: `T`, `listener`: (`event`: `GlobalDispatcherEventType`\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/evented.ts#L117>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof `GlobalDispatcherEventType` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: `GlobalDispatcherEventType`\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

---

### on()

> **on**\<`T` *extends* keyof `GlobalDispatcherEventType`\>(`type`: `T`, `listener`: (`event`: `GlobalDispatcherEventType`\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/evented.ts#L100>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof `GlobalDispatcherEventType` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: `GlobalDispatcherEventType`\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof `GlobalDispatcherEventType`\>(`type`: `T`): `Promise`\<`GlobalDispatcherEventType`\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/evented.ts#L132>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof `GlobalDispatcherEventType` |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<`GlobalDispatcherEventType`\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof `GlobalDispatcherEventType`\>(`type`: `T`, `listener`: (`event`: `GlobalDispatcherEventType`\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/evented.ts#L142>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof `GlobalDispatcherEventType` |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: `GlobalDispatcherEventType`\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

---

### ping()

> **ping**(`timeoutMs?`: `number`): `Promise`\<`boolean`\>

Defined in: [util/global\_dispatcher.ts:218](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L218>)

Pings the workers, resolving false only on silence: any answer, even an error, proves they are alive. Resolves true when no workers exist, since there is nothing to restart.

#### Parameters

| Parameter | Type | Default value |
| --- | --- | --- |
| `timeoutMs?` | `number` | `PING_TIMEOUT_MS` |

#### Returns

`Promise`\<`boolean`\>

---

### registerMessageHandler()

#### Call Signature

> **registerMessageHandler**\<`T` *extends* [`MessageType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>)\>(`type`: `T`, `handler`: `MessageHandler`\<`T`\>): `Promise`\<`void`\>

Defined in: [util/global\_dispatcher.ts:158](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L158>)

Registers a handler for messages that the workers send to this dispatcher. The type can be any string, to allow handling messages that are sent by a script that was imported using [importScriptInWorkers](<https://maplibre.org/maplibre-gl-js/docs/API/functions/importScriptInWorkers/index.md>).

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* [`MessageType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>) |

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | `T` |
| `handler` | `MessageHandler`\<`T`\> |

##### Returns

`Promise`\<`void`\>

#### Call Signature

> **registerMessageHandler**\<`TData` = `any`, `TResult` = `any`\>(`type`: `string`, `handler`: [`CustomMessageHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomMessageHandler/index.md>)\<`TData`, `TResult`\>): `Promise`\<`void`\>

Defined in: [util/global\_dispatcher.ts:159](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L159>)

Registers a handler for messages that the workers send to this dispatcher. The type can be any string, to allow handling messages that are sent by a script that was imported using [importScriptInWorkers](<https://maplibre.org/maplibre-gl-js/docs/API/functions/importScriptInWorkers/index.md>).

##### Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `TData` | `any` |
| `TResult` | `any` |

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | `string` |
| `handler` | [`CustomMessageHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomMessageHandler/index.md>)\<`TData`, `TResult`\> |

##### Returns

`Promise`\<`void`\>

---

### setEventedParent()

> **setEventedParent**(`parent?`: [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>, `data?`: [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) | (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>))): `this`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/evented.ts#L217>)

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

### watchWorkers()

> **watchWorkers**(): `void`

Defined in: [util/global\_dispatcher.ts:189](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L189>)

Pings the workers on every return to the foreground, restarting them if the browser terminated them while the page was hidden, as iOS does under memory pressure. Browsers fire no event for the termination, so the ping is the only way to notice it. Each map then recovers through the same contract as a lost WebGL context, see `Map._handleWorkersRestarted`.

#### Returns

`void`

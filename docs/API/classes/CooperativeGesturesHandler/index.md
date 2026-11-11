# CooperativeGesturesHandler

Defined in: [ui/handler/cooperative\_gestures.ts:29](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler/cooperative_gestures.ts#L29>)

A `CooperativeGestureHandler` is a control that adds cooperative gesture info when user tries to zoom in/out.

When the CooperativeGestureHandler blocks a gesture, it will emit a `cooperativegestureprevented` event.

## Example

```ts
const map = new Map({
  cooperativeGestures: true
});
```

## See

[Example: cooperative gestures](<https://maplibre.org/maplibre-gl-js/docs/examples/cooperative-gestures/>)

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>

## Implements

- [`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>)

## Methods

### fire()

#### Call Signature

> **fire**(`event`: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) | [`MapStyleImageMissingEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>) | [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`unknown`\> | [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) | [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>) | [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>) | [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>) | [`MapStyleLoadEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>) | [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>) | [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>) | [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>) | [`MapWheelEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>) | [`MapTerrainEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>) | [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`TouchEvent` | `WheelEvent`\> &amp; `object` | [`MapProjectionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) \| [`MapStyleImageMissingEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>) \| [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`unknown`\> \| [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) \| [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>) \| [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>) \| [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>) \| [`MapStyleLoadEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>) \| [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>) \| [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>) \| [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>) \| [`MapWheelEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>) \| [`MapTerrainEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>) \| [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`TouchEvent` \| `WheelEvent`\> &amp; `object` \| [`MapProjectionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

#### Call Signature

> **fire**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/cooperative\_gestures.ts:52](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler/cooperative_gestures.ts#L52>)

This is used to indicate if the handler is currently active or not. In case a handler is active, it will block other handlers from getting the relevant events. There is an allow list of handlers that can be active at the same time, which is configured when adding a handler.

#### Returns

`boolean`

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`isActive`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/#isactive>)

---

### listens()

> **listens**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### off()

> **off**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/evented.ts#L117>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

---

### on()

> **on**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/evented.ts#L100>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`): `Promise`\<[`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/evented.ts#L132>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/evented.ts#L142>)

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

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

---

### reset()

> **reset**(): `void`

Defined in: [ui/handler/cooperative\_gestures.ts:55](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler/cooperative_gestures.ts#L55>)

`reset` can be called by the manager at any time and must reset everything to it's original state

#### Returns

`void`

#### Implementation of

[`Handler`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/index.md>).[`reset`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Handler/#reset>)

---

### setEventedParent()

> **setEventedParent**(`parent?`: [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>, `data?`: [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) | (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>))): `this`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/evented.ts#L217>)

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

## Properties

### \_bypassKey

> **\_bypassKey**: `"ctrlKey"` | `"metaKey"`

Defined in: [ui/handler/cooperative\_gestures.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/handler/cooperative_gestures.ts#L37>)

This is the key that will allow to bypass the cooperative gesture protection

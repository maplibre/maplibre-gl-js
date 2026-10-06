# FullscreenControl

Defined in: [ui/control/fullscreen\_control.ts:75](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/fullscreen_control.ts#L75>)

A `FullscreenControl` control contains a button for toggling the map in and out of fullscreen mode. When [requestFullscreen](<https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen>) is not supported, fullscreen is handled via CSS properties. The map's `cooperativeGestures` option is temporarily disabled while the map is in fullscreen mode, and is restored when the map exist fullscreen mode.

## Param

**options**

the full screen control options

## Example

```ts
map.addControl(new FullscreenControl({container: document.querySelector('body')}));
```

## See

[View a fullscreen map](<https://maplibre.org/maplibre-gl-js/docs/examples/view-a-fullscreen-map/>)

## Events

**Event** `fullscreenstart` of type [FullscreenEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenEvent/index.md>) will be fired when fullscreen mode has started.

**Event** `fullscreenend` of type [FullscreenEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenEvent/index.md>) will be fired when fullscreen mode has ended.

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\>

## Implements

- [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)

## Constructors

### Constructor

> **new FullscreenControl**(`options?`: [`FullscreenControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlOptions/index.md>)): `FullscreenControl`

Defined in: [ui/control/fullscreen\_control.ts:88](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/fullscreen_control.ts#L88>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`FullscreenControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlOptions/index.md>) | the control's options |

#### Returns

`FullscreenControl`

#### Overrides

`Evented<FullscreenControlEventType>.constructor`

## Methods

### fire()

#### Call Signature

> **fire**(`event`: [`FullscreenEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`FullscreenEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

#### Call Signature

> **fire**(`type`: keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### listens()

> **listens**(`type`: keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### off()

> **off**\<`T` *extends* keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L117>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

---

### on()

> **on**\<`T` *extends* keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L100>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

---

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `HTMLElement`

Defined in: [ui/control/fullscreen\_control.ts:113](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/fullscreen_control.ts#L113>)

Register a control on the map and give it a chance to register event listeners and resources. This method is called by [Map.addControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addcontrol>) internally.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | the Map this control will be added to |

#### Returns

`HTMLElement`

The control's container element. This should be created by the control and returned by onAdd without being attached to the DOM: the map will insert the control's element into the DOM as necessary.

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`onAdd`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#onadd>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\>(`type`: `T`): `Promise`\<[`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L132>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<[`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L142>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: [`FullscreenControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

---

### onRemove()

> **onRemove**(): `void`

Defined in: [ui/control/fullscreen\_control.ts:122](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/fullscreen_control.ts#L122>)

Unregister a control on the map and give it a chance to detach event listeners and resources. This method is called by [Map.removeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removecontrol>) internally.

#### Returns

`void`

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#onremove>)

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

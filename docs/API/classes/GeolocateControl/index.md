# GeolocateControl

Defined in: [ui/control/geolocate\_control.ts:342](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L342>)

A `GeolocateControl` control provides a button that uses the browser's geolocation API to locate the user on the map.

Not all browsers support geolocation, and some users may disable the feature. Geolocation support for modern browsers including Chrome requires sites to be served over HTTPS. If geolocation support is not available, the `GeolocateControl` will show as disabled.

The zoom level applied will depend on the accuracy of the geolocation provided by the device.

The `GeolocateControl` has two modes. If `trackUserLocation` is `false` (default) the control acts as a button, which when pressed will set the map's camera to target the user location. If the user moves, the map won't update. This is most suited for the desktop. If `trackUserLocation` is `true` the control acts as a toggle button that when active the user's location is actively monitored for changes. In this mode the `GeolocateControl` has three interaction states: \* active - the map's camera automatically updates as the user's location changes, keeping the location dot in the center. Initial state and upon clicking the `GeolocateControl` button. \* passive - the user's location dot automatically updates, but the map's camera does not. Occurs upon the user initiating a map movement. \* disabled - occurs if Geolocation is not available, disabled or denied.

These interaction states can't be controlled programmatically, rather they are set based on user interactions.

## State Diagram

## Examples

```ts
map.addControl(new GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true
}));
```

```ts
// Initialize the geolocate control.
let geolocate = new GeolocateControl({
  positionOptions: {
      enableHighAccuracy: true
  },
  trackUserLocation: true
});
// Add the control to the map.
map.addControl(geolocate);
// Set an event listener that fires
// when a trackuserlocationend event occurs.
geolocate.on('trackuserlocationend', () => {
  console.log('A trackuserlocationend event has occurred.')
});
```

```ts
// Initialize the geolocate control.
let geolocate = new GeolocateControl({
  positionOptions: {
      enableHighAccuracy: true
  },
  trackUserLocation: true
});
// Add the control to the map.
map.addControl(geolocate);
// Set an event listener that fires
// when a trackuserlocationstart event occurs.
geolocate.on('trackuserlocationstart', () => {
  console.log('A trackuserlocationstart event has occurred.')
});
```

```ts
// Initialize the geolocate control.
let geolocate = new GeolocateControl({
  positionOptions: {
      enableHighAccuracy: true
  },
  trackUserLocation: true
});
// Add the control to the map.
map.addControl(geolocate);
// Set an event listener that fires
// when an userlocationlostfocus event occurs.
geolocate.on('userlocationlostfocus', function() {
  console.log('An userlocationlostfocus event has occurred.')
});
```

```ts
// Initialize the geolocate control.
let geolocate = new GeolocateControl({
  positionOptions: {
      enableHighAccuracy: true
  },
  trackUserLocation: true
});
// Add the control to the map.
map.addControl(geolocate);
// Set an event listener that fires
// when an userlocationfocus event occurs.
geolocate.on('userlocationfocus', function() {
  console.log('An userlocationfocus event has occurred.')
});
```

```ts
// Initialize the geolocate control.
let geolocate = new GeolocateControl({
  positionOptions: {
      enableHighAccuracy: true
  },
  trackUserLocation: true
});
// Add the control to the map.
map.addControl(geolocate);
// Set an event listener that fires
// when a geolocate event occurs.
geolocate.on('geolocate', () => {
  console.log('A geolocate event has occurred.')
});
```

```ts
// Initialize the geolocate control.
let geolocate = new GeolocateControl({
  positionOptions: {
      enableHighAccuracy: true
  },
  trackUserLocation: true
});
// Add the control to the map.
map.addControl(geolocate);
// Set an event listener that fires
// when an error event occurs.
geolocate.on('error', () => {
  console.log('An error event has occurred.')
});
```

```ts
// Initialize the geolocate control.
let geolocate = new GeolocateControl({
  positionOptions: {
      enableHighAccuracy: true
  },
  trackUserLocation: true
});
// Add the control to the map.
map.addControl(geolocate);
// Set an event listener that fires
// when an outofmaxbounds event occurs.
geolocate.on('outofmaxbounds', () => {
  console.log('An outofmaxbounds event has occurred.')
});
```

## See

[Locate the user](<https://maplibre.org/maplibre-gl-js/docs/examples/locate-the-user/>)

## Events

**Event** `trackuserlocationend` of type [Event](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>) will be fired when the `GeolocateControl` changes to the background state, which happens when a user changes the camera during an active position lock. This only applies when `trackUserLocation` is `true`. In the background state, the dot on the map will update with location updates but the camera will not.

**Event** `trackuserlocationstart` of type [Event](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>) will be fired when the `GeolocateControl` changes to the active lock state, which happens either upon first obtaining a successful Geolocation API position for the user (a `geolocate` event will follow), or the user clicks the geolocate button when in the background state which uses the last known position to recenter the map and enter active lock state (no `geolocate` event will follow unless the users's location changes).

**Event** `userlocationlostfocus` of type [Event](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>) will be fired when the `GeolocateControl` changes to the background state, which happens when a user changes the camera during an active position lock. This only applies when `trackUserLocation` is `true`. In the background state, the dot on the map will update with location updates but the camera will not.

**Event** `userlocationfocus` of type [Event](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>) will be fired when the `GeolocateControl` changes to the active lock state, which happens upon the user clicks the geolocate button when in the background state which uses the last known position to recenter the map and enter active lock state.

**Event** `geolocate` of type [Event](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>) will be fired on each Geolocation API position update which returned as success. `data` - The returned [Position](<https://developer.mozilla.org/en-US/docs/Web/API/Position>) object from the callback in [Geolocation.getCurrentPosition()](<https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition>) or [Geolocation.watchPosition()](<https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition>).

**Event** `error` of type [Event](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>) will be fired on each Geolocation API position update which returned as an error. `data` - The returned [PositionError](<https://developer.mozilla.org/en-US/docs/Web/API/PositionError>) object from the callback in [Geolocation.getCurrentPosition()](<https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition>) or [Geolocation.watchPosition()](<https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition>).

**Event** `outofmaxbounds` of type [Event](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Event/index.md>) will be fired on each Geolocation API position update which returned as success but user position is out of map `maxBounds`. `data` - The returned [Position](<https://developer.mozilla.org/en-US/docs/Web/API/Position>) object from the callback in [Geolocation.getCurrentPosition()](<https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition>) or [Geolocation.watchPosition()](<https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition>).

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\>

## Implements

- [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)

## Constructors

### Constructor

> **new GeolocateControl**(`options`: [`GeolocateControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlOptions/index.md>)): `GeolocateControl`

Defined in: [ui/control/geolocate\_control.ts:377](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L377>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`GeolocateControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlOptions/index.md>) | the control's options |

#### Returns

`GeolocateControl`

#### Overrides

`Evented<GeolocateControlEventType>.constructor`

## Methods

### \_isOutOfMapMaxBounds()

> **\_isOutOfMapMaxBounds**(`position`: `GeolocationPosition`): `boolean`

Defined in: [ui/control/geolocate\_control.ts:424](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L424>)

Check if the Geolocation API Position is outside the map's `maxBounds`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `position` | `GeolocationPosition` | the Geolocation API Position |

#### Returns

`boolean`

`true` if position is outside the map's `maxBounds`, otherwise returns `false`.

---

### \_onSuccess()

> **\_onSuccess**(`position`: `GeolocationPosition`): `void`

Defined in: [ui/control/geolocate\_control.ts:477](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L477>)

When the Geolocation API returns a new location, update the `GeolocateControl`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `position` | `GeolocationPosition` | the Geolocation API Position |

#### Returns

`void`

---

### \_updateCamera()

> **\_updateCamera**(`position`: `GeolocationPosition`): `void`

Defined in: [ui/control/geolocate\_control.ts:545](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L545>)

Update the camera location to center on the current position. The camera change is tagged with `geolocateSource` so it does not switch the control to the background state.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `position` | `GeolocationPosition` | the Geolocation API Position |

#### Returns

`void`

---

### \_updateMarker()

> **\_updateMarker**(`position?`: `GeolocationPosition`): `void`

Defined in: [ui/control/geolocate\_control.ts:572](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L572>)

Update the user location dot Marker to the current position

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `position?` | `GeolocationPosition` | the Geolocation API Position |

#### Returns

`void`

---

### fire()

#### Call Signature

> **fire**(`event`: [`GeolocateEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateEvent/index.md>) | [`GeolocatePositionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocatePositionEvent/index.md>) | [`GeolocateErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateErrorEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`GeolocateEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateEvent/index.md>) \| [`GeolocatePositionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocatePositionEvent/index.md>) \| [`GeolocateErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateErrorEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

#### Call Signature

> **fire**(`type`: keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### listens()

> **listens**(`type`: keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### off()

> **off**\<`T` *extends* keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L117>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

---

### on()

> **on**\<`T` *extends* keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L100>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

---

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `HTMLElement`

Defined in: [ui/control/geolocate\_control.ts:383](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L383>)

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

> **once**\<`T` *extends* keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\>(`type`: `T`): `Promise`\<[`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L132>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<[`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L142>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: [`GeolocateControlEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

---

### onRemove()

> **onRemove**(): `void`

Defined in: [ui/control/geolocate\_control.ts:392](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L392>)

Unregister a control on the map and give it a chance to detach event listeners and resources. This method is called by [Map.removeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removecontrol>) internally.

#### Returns

`void`

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#onremove>)

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

### trigger()

> **trigger**(): `boolean`

Defined in: [ui/control/geolocate\_control.ts:747](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/geolocate_control.ts#L747>)

Programmatically request and move the map to the user's location.

#### Returns

`boolean`

`false` if called before control was added to a map, otherwise returns `true`.

#### Example

```ts
// Initialize the geolocate control.
let geolocate = new GeolocateControl({
 positionOptions: {
   enableHighAccuracy: true
 },
 trackUserLocation: true
});
// Add the control to the map.
map.addControl(geolocate);
map.on('load', () => {
  geolocate.trigger();
});
```

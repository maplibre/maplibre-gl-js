# Marker

Defined in: [ui/marker.ts:288](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L288>)

Creates a marker component

## Examples

```ts
let marker = new Marker()
  .setLngLat([30.5, 50.5])
  .addTo(map);
```

Set options

```ts
let marker = new Marker({
    color: "#FFFFFF",
    draggable: true
  }).setLngLat([30.5, 50.5])
  .addTo(map);
```

```css
.maplibregl-marker-covered {
    pointer-events: none;
    cursor: default;
}
```

## See

- [Add a default marker](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-default-marker/>)
- [Add custom icons with Markers](<https://maplibre.org/maplibre-gl-js/docs/examples/add-custom-icons-with-markers/>)
- [Create a draggable Marker](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-marker/>)
- [Animate a marker](<https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-marker/>)
- [Attach a popup to a marker instance](<https://maplibre.org/maplibre-gl-js/docs/examples/attach-a-popup-to-a-marker-instance/>)

## Events

**Event** `dragstart` of type [MarkerDragEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerDragEvent/index.md>) will be fired when dragging starts.

**Event** `drag` of type [MarkerDragEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerDragEvent/index.md>) will be fired while dragging.

**Event** `dragend` of type [MarkerDragEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerDragEvent/index.md>) will be fired when the marker is finished being dragged.

**Event** `click` of type [MarkerClickEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerClickEvent/index.md>) will be fired when the marker is clicked.

## CSS Classes

**CSS class** `maplibregl-marker-covered` is toggled on the marker element when the marker is hidden behind 3D terrain or on the back of a globe. Use this class to apply custom styles to covered markers.

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\>

## Constructors

### Constructor

> **new Marker**(`options?`: [`MarkerOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerOptions/index.md>)): `Marker`

Defined in: [ui/marker.ts:319](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L319>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`MarkerOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerOptions/index.md>) | the options |

#### Returns

`Marker`

#### Overrides

`Evented<MarkerEventType>.constructor`

## Methods

### \_onKeyDown()

> **\_onKeyDown**(`e`: `KeyboardEvent`): `void`

Defined in: [ui/marker.ts:586](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L586>)

Move a focused draggable default marker with the arrow keys (1 screen pixel per keydown; 10 with Shift). Mirrors the pointer drag gesture: the position updates before `dragstart` fires on the first movement, every movement fires `drag`, and releasing the arrow key (or losing focus) fires `dragend`. Holding a key down produces repeated `drag` events within a single gesture.

#### Parameters

| Parameter | Type |
| --- | --- |
| `e` | `KeyboardEvent` |

#### Returns

`void`

---

### \_updateAccessibilityRole()

> **\_updateAccessibilityRole**(): `void`

Defined in: [ui/marker.ts:989](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L989>)

Keep the default marker role aligned with interactivity. Default markers need a role because `aria-label` is set in [Marker.addTo](<#addto>). Non-interactive markers use `role=img`; interactive ones (draggable or with a popup) use `role=button`. Click listeners are application-owned and do not automatically change the role. Custom marker elements are left alone so applications own their a11y tree. Explicit roles set by the application are preserved.

#### Returns

`void`

---

### \_updateTabIndex()

> **\_updateTabIndex**(): `void`

Defined in: [ui/marker.ts:965](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L965>)

Keep the marker element focusable while it has built-in keyboard behavior. A popup makes any marker element interactive; dragging only manages focusability for the default marker so custom elements stay application-owned (\#7790). A tabindex supplied by the application is never added, changed, or removed here.

#### Returns

`void`

---

### addClassName()

> **addClassName**(`className`: `string`): `void`

Defined in: [ui/marker.ts:811](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L811>)

Adds a CSS class to the marker element.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `className` | `string` | on-empty string with CSS class name to add to marker element |

#### Returns

`void`

#### Example

```text
let marker = new Marker()
marker.addClassName('some-class')
```

---

### addTo()

> **addTo**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `this`

Defined in: [ui/marker.ts:391](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L391>)

Attaches the `Marker` to a `Map` object.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The MapLibre GL JS map to add the marker to. |

#### Returns

`this`

#### Example

```ts
let marker = new Marker()
  .setLngLat([30.5, 50.5])
  .addTo(map); // add the marker to the map
```

---

### fire()

#### Call Signature

> **fire**(`event`: [`MarkerDragEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerDragEvent/index.md>) | [`MarkerClickEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerClickEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`MarkerDragEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerDragEvent/index.md>) \| [`MarkerClickEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerClickEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

#### Call Signature

> **fire**(`type`: keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### getElement()

> **getElement**(): `HTMLElement`

Defined in: [ui/marker.ts:502](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L502>)

Returns the `Marker`'s HTML element.

#### Returns

`HTMLElement`

element

---

### getLngLat()

> **getLngLat**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [ui/marker.ts:473](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L473>)

Get the marker's geographical location.

The longitude of the result may differ by a multiple of 360 degrees from the longitude previously set by `setLngLat` because `Marker` wraps the anchor longitude across copies of the world to keep the marker on screen.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

A [LngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) describing the marker's location.

#### Example

```ts
// Store the marker's longitude and latitude coordinates in a variable
let lngLat = marker.getLngLat();
// Print the marker's longitude and latitude values in the console
console.log('Longitude: ' + lngLat.lng + ', Latitude: ' + lngLat.lat )
```

#### See

[Create a draggable Marker](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-marker/>)

---

### getOffset()

> **getOffset**(): `Point`

Defined in: [ui/marker.ts:786](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L786>)

Get the marker's offset.

#### Returns

`Point`

The marker's screen coordinates in pixels.

---

### getPitchAlignment()

> **getPitchAlignment**(): [`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>)

Defined in: [ui/marker.ts:1054](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L1054>)

Returns the current `pitchAlignment` property of the marker.

#### Returns

[`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>)

The current pitch alignment of the marker in degrees.

---

### getPopup()

> **getPopup**(): [`Popup`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>)

Defined in: [ui/marker.ts:651](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L651>)

Returns the [Popup](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>) instance that is bound to the Marker.

#### Returns

[`Popup`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>)

popup

#### Example

```ts
let marker = new Marker()
 .setLngLat([0, 0])
 .setPopup(new Popup().setHTML("<h1>Hello World!</h1>"))
 .addTo(map);

console.log(marker.getPopup()); // return the popup instance
```

---

### getRotation()

> **getRotation**(): `number`

Defined in: [ui/marker.ts:1018](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L1018>)

Returns the current rotation angle of the marker (in degrees).

#### Returns

`number`

The current rotation angle of the marker.

---

### getRotationAlignment()

> **getRotationAlignment**(): [`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>)

Defined in: [ui/marker.ts:1036](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L1036>)

Returns the current `rotationAlignment` property of the marker.

#### Returns

[`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>)

The current rotational alignment of the marker.

---

### isDraggable()

> **isDraggable**(): `boolean`

Defined in: [ui/marker.ts:954](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L954>)

Returns true if the marker can be dragged

#### Returns

`boolean`

True if the marker is draggable.

---

### listens()

> **listens**(`type`: keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### off()

> **off**\<`T` *extends* keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L117>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

---

### on()

> **on**\<`T` *extends* keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L100>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\>(`type`: `T`): `Promise`\<[`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L132>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<[`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L142>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: [`MarkerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

---

### remove()

> **remove**(): `this`

Defined in: [ui/marker.ts:428](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L428>)

Removes the marker from a map

#### Returns

`this`

#### Example

```ts
let marker = new Marker().addTo(map);
marker.remove();
```

---

### removeClassName()

> **removeClassName**(`className`: `string`): `void`

Defined in: [ui/marker.ts:826](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L826>)

Removes a CSS class from the marker element.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `className` | `string` | Non-empty string with CSS class name to remove from marker element |

#### Returns

`void`

#### Example

```ts
let marker = new Marker()
marker.removeClassName('some-class')
```

---

### setDraggable()

> **setDraggable**(`shouldBeDraggable?`: `boolean`): `this`

Defined in: [ui/marker.ts:916](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L916>)

Sets the `draggable` property and functionality of the marker. A draggable default marker is also keyboard focusable and movable with the arrow keys (see [MarkerOptions.draggable](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerOptions/#draggable>)); custom marker elements keep their focusability and keyboard behavior application-owned.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `shouldBeDraggable?` | `boolean` | Turns drag functionality on/off |

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

### setLngLat()

> **setLngLat**(`lnglat`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `this`

Defined in: [ui/marker.ts:490](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L490>)

Set the marker's geographical position and move it.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `lnglat` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | A [LngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) describing where the marker should be located. |

#### Returns

`this`

#### Example

Create a new marker, set the longitude and latitude, and add it to the map

```ts
new Marker()
  .setLngLat([-65.017, -16.457])
  .addTo(map);
```

#### See

- [Add custom icons with Markers](<https://maplibre.org/maplibre-gl-js/docs/examples/add-custom-icons-with-markers/>)
- [Create a draggable Marker](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-marker/>)

---

### setOffset()

> **setOffset**(`offset`: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)): `this`

Defined in: [ui/marker.ts:794](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L794>)

Sets the offset of the marker

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `offset` | [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) | The offset in pixels as a [PointLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) object to apply relative to the element's center. Negatives indicate left and up. |

#### Returns

`this`

---

### setOpacity()

> **setOpacity**(`opacity?`: `string` | `number`, `opacityWhenCovered?`: `string` | `number`): `this`

Defined in: [ui/marker.ts:1064](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L1064>)

Sets the `opacity` and `opacityWhenCovered` properties of the marker. When called without arguments, resets opacity and opacityWhenCovered to defaults

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `opacity?` | `string` \| `number` | Sets the `opacity` property of the marker. |
| `opacityWhenCovered?` | `string` \| `number` | Sets the `opacityWhenCovered` property of the marker. |

#### Returns

`this`

---

### setPitchAlignment()

> **setPitchAlignment**(`alignment?`: [`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>)): `this`

Defined in: [ui/marker.ts:1044](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L1044>)

Sets the `pitchAlignment` property of the marker.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `alignment?` | [`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>) | Sets the `pitchAlignment` property of the marker. If alignment is 'auto', it will automatically match `rotationAlignment`. |

#### Returns

`this`

---

### setPopup()

> **setPopup**(`popup?`: [`Popup`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>)): `this`

Defined in: [ui/marker.ts:519](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L519>)

Binds a [Popup](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>) to the Marker.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `popup?` | [`Popup`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>) | An instance of the [Popup](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>) class. If undefined or null, any popup set on this Marker instance is unset. |

#### Returns

`this`

#### Example

```ts
let marker = new Marker()
 .setLngLat([0, 0])
 .setPopup(new Popup().setHTML("<h1>Hello World!</h1>")) // add popup
 .addTo(map);
```

#### See

[Attach a popup to a marker instance](<https://maplibre.org/maplibre-gl-js/docs/examples/attach-a-popup-to-a-marker-instance/>)

---

### setRotation()

> **setRotation**(`rotation?`: `number`): `this`

Defined in: [ui/marker.ts:1008](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L1008>)

Sets the `rotation` property of the marker.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `rotation?` | `number` | The rotation angle of the marker (clockwise, in degrees), relative to its respective [Marker.setRotationAlignment](<#setrotationalignment>) setting. |

#### Returns

`this`

---

### setRotationAlignment()

> **setRotationAlignment**(`alignment?`: [`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>)): `this`

Defined in: [ui/marker.ts:1026](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L1026>)

Sets the `rotationAlignment` property of the marker.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `alignment?` | [`Alignment`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Alignment/index.md>) | Sets the `rotationAlignment` property of the marker. defaults to 'auto' |

#### Returns

`this`

---

### setSubpixelPositioning()

> **setSubpixelPositioning**(`value`: `boolean`): `this`

Defined in: [ui/marker.ts:563](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L563>)

Set the option to allow subpixel positioning of the marker by passing a boolean

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `value` | `boolean` | when set to `true`, subpixel positioning is enabled for the marker. |

#### Returns

`this`

#### Example

```ts
let marker = new Marker()
marker.setSubpixelPositioning(true);
```

---

### toggleClassName()

> **toggleClassName**(`className`: `string`): `boolean`

Defined in: [ui/marker.ts:843](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L843>)

Add or remove the given CSS class on the marker element, depending on whether the element currently has that class.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `className` | `string` | Non-empty string with CSS class name to add/remove |

#### Returns

`boolean`

if the class was removed return false, if class was added, then return true

#### Example

```ts
let marker = new Marker()
marker.toggleClassName('toggleClass')
```

---

### togglePopup()

> **togglePopup**(): `this`

Defined in: [ui/marker.ts:667](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/marker.ts#L667>)

Opens or closes the [Popup](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>) instance that is bound to the Marker, depending on the current state of the [Popup](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>).

#### Returns

`this`

#### Example

```ts
let marker = new Marker()
 .setLngLat([0, 0])
 .setPopup(new Popup().setHTML("<h1>Hello World!</h1>"))
 .addTo(map);

marker.togglePopup(); // toggle popup open or closed
```

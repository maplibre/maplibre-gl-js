# Popup

Defined in: [ui/popup.ts:208](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L208>)

A popup component.

## Examples

Create a popup

```ts
let popup = new Popup();
// Set an event listener that will fire
// any time the popup is opened
popup.on('open', () => {
  console.log('popup was opened');
});
```

Create a popup

```ts
let popup = new Popup();
// Set an event listener that will fire
// any time the popup is closed
popup.on('close', () => {
  console.log('popup was closed');
});
```

```ts
let markerHeight = 50, markerRadius = 10, linearOffset = 25;
let popupOffsets = {
 'top': [0, 0],
 'top-left': [0,0],
 'top-right': [0,0],
 'bottom': [0, -markerHeight],
 'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 'left': [markerRadius, (markerHeight - markerRadius) * -1],
 'right': [-markerRadius, (markerHeight - markerRadius) * -1]
 };
let popup = new Popup({offset: popupOffsets, className: 'my-class'})
  .setLngLat(e.lngLat)
  .setHTML("<h1>Hello World!</h1>")
  .setMaxWidth("300px")
  .addTo(map);
```

## See

- [Display a popup](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup/>)
- [Display a popup on hover](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/>)
- [Display a popup on click](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-click/>)
- [Attach a popup to a marker instance](<https://maplibre.org/maplibre-gl-js/docs/examples/attach-a-popup-to-a-marker-instance/>)
- [Show polygon information on click](<https://maplibre.org/maplibre-gl-js/docs/examples/show-polygon-information-on-click/>)

## Events

**Event** `open` of type [PopupEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/PopupEvent/index.md>) will be fired when the popup is opened manually or programmatically.

**Event** `close` of type [PopupEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/PopupEvent/index.md>) will be fired when the popup is closed manually or programmatically.

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\>

## Constructors

### Constructor

> **new Popup**(`options?`: [`PopupOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupOptions/index.md>)): `Popup`

Defined in: [ui/popup.ts:223](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L223>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`PopupOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupOptions/index.md>) | the options |

#### Returns

`Popup`

#### Overrides

`Evented<PopupEventType>.constructor`

## Methods

### \_updateOpacity()

> **\_updateOpacity**(): `void`

Defined in: [ui/popup.ts:282](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L282>)

Add opacity to popup if in globe projection and location is behind view

#### Returns

`void`

---

### addClassName()

> **addClassName**(`className`: `string`): `this`

Defined in: [ui/popup.ts:546](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L546>)

Adds a CSS class to the popup container element.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `className` | `string` | Non-empty string with CSS class name to add to popup container |

#### Returns

`this`

#### Example

```ts
let popup = new Popup()
popup.addClassName('some-class')
```

---

### addTo()

> **addTo**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `this`

Defined in: [ui/popup.ts:244](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L244>)

Adds the popup to a map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The MapLibre GL JS map to add the popup to. |

#### Returns

`this`

#### Example

```ts
new Popup()
  .setLngLat([0, 0])
  .setHTML("<h1>Null Island</h1>")
  .addTo(map);
```

#### See

- [Display a popup](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup/>)
- [Display a popup on hover](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/>)
- [Display a popup on click](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-click/>)
- [Show polygon information on click](<https://maplibre.org/maplibre-gl-js/docs/examples/show-polygon-information-on-click/>)

---

### fire()

#### Call Signature

> **fire**(`event`: [`PopupEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/PopupEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`PopupEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/PopupEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

#### Call Signature

> **fire**(`type`: keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### getElement()

> **getElement**(): `HTMLElement`

Defined in: [ui/popup.ts:421](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L421>)

Returns the `Popup`'s HTML element.

#### Returns

`HTMLElement`

element

#### Example

Change the `Popup` element's font size

```ts
let popup = new Popup()
  .setLngLat([-96, 37.8])
  .setHTML("<p>Hello World!</p>")
  .addTo(map);
let popupElem = popup.getElement();
popupElem.style.fontSize = "25px";
```

---

### getLngLat()

> **getLngLat**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [ui/popup.ts:347](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L347>)

Returns the geographical location of the popup's anchor.

The longitude of the result may differ by a multiple of 360 degrees from the longitude previously set by `setLngLat` because `Popup` wraps the anchor longitude across copies of the world to keep the popup on screen.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The geographical location of the popup's anchor.

---

### getMaxWidth()

> **getMaxWidth**(): `string`

Defined in: [ui/popup.ts:484](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L484>)

Returns the popup's maximum width.

#### Returns

`string`

The maximum width of the popup.

---

### isOpen()

> **isOpen**(): `boolean`

Defined in: [ui/popup.ts:296](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L296>)

#### Returns

`boolean`

`true` if the popup is open, `false` if it is closed.

---

### listens()

> **listens**(`type`: keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### off()

> **off**\<`T` *extends* keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L117>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

---

### on()

> **on**\<`T` *extends* keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L100>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\>(`type`: `T`): `Promise`\<[`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L132>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<[`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L142>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: [`PopupEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

---

### remove()

> **remove**(): `this`

Defined in: [ui/popup.ts:309](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L309>)

Removes the popup from the map it has been added to.

#### Returns

`this`

#### Example

```ts
let popup = new Popup().addTo(map);
popup.remove();
```

---

### removeClassName()

> **removeClassName**(`className`: `string`): `this`

Defined in: [ui/popup.ts:564](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L564>)

Removes a CSS class from the popup container element.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `className` | `string` | Non-empty string with CSS class name to remove from popup container |

#### Returns

`this`

#### Example

```ts
let popup = new Popup()
popup.removeClassName('some-class')
```

---

### setDOMContent()

> **setDOMContent**(`htmlNode`: `Node`): `this`

Defined in: [ui/popup.ts:515](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L515>)

Sets the popup's content to the element provided as a DOM node.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `htmlNode` | `Node` | A DOM node to be used as content for the popup. |

#### Returns

`this`

#### Example

Create an element with the popup content

```ts
let div = document.createElement('div');
div.innerHTML = 'Hello, world!';
let popup = new Popup()
  .setLngLat(e.lngLat)
  .setDOMContent(div)
  .addTo(map);
```

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

### setHTML()

> **setHTML**(`html`: `string`): `this`

Defined in: [ui/popup.ts:465](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L465>)

Sets the popup's content to the HTML provided as a string.

This method does not perform HTML filtering or sanitization, and must be used only with trusted content. Consider [Popup.setText](<#settext>) if the content is an untrusted text string.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `html` | `string` | A string representing HTML content for the popup. |

#### Returns

`this`

#### Example

```ts
let popup = new Popup()
  .setLngLat(e.lngLat)
  .setHTML("<h1>Hello World!</h1>")
  .addTo(map);
```

#### See

- [Display a popup](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup/>)
- [Display a popup on hover](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/>)
- [Display a popup on click](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-click/>)
- [Attach a popup to a marker instance](<https://maplibre.org/maplibre-gl-js/docs/examples/attach-a-popup-to-a-marker-instance/>)

---

### setLngLat()

> **setLngLat**(`lnglat`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `this`

Defined in: [ui/popup.ts:356](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L356>)

Sets the geographical location of the popup's anchor, and moves the popup to it. Replaces trackPointer() behavior.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `lnglat` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | The geographical location to set as the popup's anchor. |

#### Returns

`this`

---

### setMaxWidth()

> **setMaxWidth**(`maxWidth`: `string`): `this`

Defined in: [ui/popup.ts:494](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L494>)

Sets the popup's maximum width. This is setting the CSS property `max-width`. Available values can be found here: https://developer.mozilla.org/en-US/docs/Web/CSS/max-width

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `maxWidth` | `string` | A string representing the value for the maximum width. |

#### Returns

`this`

---

### setOffset()

> **setOffset**(`offset?`: [`Offset`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Offset/index.md>)): `this`

Defined in: [ui/popup.ts:576](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L576>)

Sets the popup's offset.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `offset?` | [`Offset`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Offset/index.md>) | Sets the popup's offset. |

#### Returns

`this`

---

### setPadding()

> **setPadding**(`padding?`: [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)): `void`

Defined in: [ui/popup.ts:625](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L625>)

Sets the popup's padding constraints for positioning.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `padding?` | [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>) | The padding to apply as a [PaddingOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>) object. |

#### Returns

`void`

#### Example

```ts
popup.setPadding({ top: 10, right: 20, bottom: 30, left: 40 });
```

---

### setSubpixelPositioning()

> **setSubpixelPositioning**(`value`: `boolean`): `void`

Defined in: [ui/popup.ts:612](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L612>)

Set the option to allow subpixel positioning of the popup by passing a boolean

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `value` | `boolean` | When boolean is true, subpixel positioning is enabled for the popup. |

#### Returns

`void`

#### Example

```ts
let popup = new Popup()
popup.setSubpixelPositioning(true);
```

---

### setText()

> **setText**(`text`: `string`): `this`

Defined in: [ui/popup.ts:441](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L441>)

Sets the popup's content to a string of text.

This function creates a [Text](<https://developer.mozilla.org/en-US/docs/Web/API/Text>) node in the DOM, so it cannot insert raw HTML. Use this method for security against XSS if the popup content is user-provided.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `text` | `string` | Textual content for the popup. |

#### Returns

`this`

#### Example

```ts
let popup = new Popup()
  .setLngLat(e.lngLat)
  .setText('Hello, world!')
  .addTo(map);
```

---

### toggleClassName()

> **toggleClassName**(`className`: `string`): `boolean`

Defined in: [ui/popup.ts:595](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L595>)

Add or remove the given CSS class on the popup container, depending on whether the container currently has that class.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `className` | `string` | Non-empty string with CSS class name to add/remove |

#### Returns

`boolean`

if the class was removed return false, if class was added, then return true, undefined if there is no container

#### Example

```ts
let popup = new Popup()
popup.toggleClassName('toggleClass')
```

---

### trackPointer()

> **trackPointer**(): `this`

Defined in: [ui/popup.ts:388](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/popup.ts#L388>)

Tracks the popup anchor to the cursor position on screens with a pointer device (it will be hidden on touchscreens). Replaces the `setLngLat` behavior. For most use cases, set `closeOnClick` and `closeButton` to `false`.

#### Returns

`this`

#### Example

```ts
let popup = new Popup({ closeOnClick: false, closeButton: false })
  .setHTML("<h1>Hello World!</h1>")
  .trackPointer()
  .addTo(map);
```

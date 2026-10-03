# MapLayerEventType

> **MapLayerEventType** = `object`

Defined in: [ui/events.ts:51](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L51>)

`MapLayerEventType` - a mapping between the event name and the event.

> [!NOTE]
>
> These events are compatible with the optional `layerId` parameter.

If `layerId` is included as the second argument in [Map.on](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#on>), the event listener will fire only when the event action contains a visible portion of the specified layer. The following example can be used for all the events.

## Example

```ts
// Initialize the map
let map = new Map({ // map options });
// Set an event listener for a specific layer
map.on('the-event-name', 'poi-label', (e) => {
  console.log('An event has occurred on a visible portion of the poi-label layer');
});
```

## Properties

### click

> **click**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:58](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L58>)

Fired when a pointing device (usually a mouse) is pressed and released contains a visible portion of the specified layer.

#### See

- [Measure distances](<https://maplibre.org/maplibre-gl-js/docs/examples/measure-distances/>)
- [Center the map on a clicked symbol](<https://maplibre.org/maplibre-gl-js/docs/examples/center-the-map-on-a-clicked-symbol/>)

---

### contextmenu

> **contextmenu**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L117>)

Fired when the right button of the mouse is clicked or the context menu key is pressed within visible portion of the specified layer.

---

### dblclick

> **dblclick**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:65](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L65>)

Fired when a pointing device (usually a mouse) is pressed and released twice contains a visible portion of the specified layer.

> [!NOTE]
>
> Under normal conditions, this event will be preceded by two `click` events.

---

### mousedown

> **mousedown**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:70](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L70>)

Fired when a pointing device (usually a mouse) is pressed while inside a visible portion of the specified layer.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### mouseenter

> **mouseenter**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:93](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L93>)

Fired when a pointing device (usually a mouse) enters a visible portion of a specified layer from outside that layer or outside the map canvas.

#### See

- [Center the map on a clicked symbol](<https://maplibre.org/maplibre-gl-js/docs/examples/center-the-map-on-a-clicked-symbol/>)
- [Display a popup on click](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-click/>)

---

### mouseleave

> **mouseleave**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:101](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L101>)

Fired when a pointing device (usually a mouse) leaves a visible portion of a specified layer, or leaves the map canvas.

#### See

- [Highlight features under the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/>)
- [Display a popup on click](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-click/>)

---

### mousemove

> **mousemove**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:85](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L85>)

Fired when a pointing device (usually a mouse) is moved while the cursor is inside a visible portion of the specified layer. As you move the cursor across the layer, the event will fire every time the cursor changes position within that layer.

#### See

- [Get coordinates of the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/get-coordinates-of-the-mouse-pointer/>)
- [Highlight features under the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/>)
- [Display a popup on over](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/>)
- [Animate symbol to follow the mouse](<https://maplibre.org/maplibre-gl-js/docs/examples/animate-symbol-to-follow-the-mouse/>)

---

### mouseout

> **mouseout**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:113](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L113>)

Fired when a point device (usually a mouse) leaves the visible portion of the specified layer.

---

### mouseover

> **mouseover**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:109](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L109>)

Fired when a pointing device (usually a mouse) is moved inside a visible portion of the specified layer.

#### See

- [Get coordinates of the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/get-coordinates-of-the-mouse-pointer/>)
- [Highlight features under the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/>)
- [Display a popup on hover](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/>)

---

### mouseup

> **mouseup**: [`MapLayerMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)

Defined in: [ui/events.ts:75](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L75>)

Fired when a pointing device (usually a mouse) is released while inside a visible portion of the specified layer.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### touchcancel

> **touchcancel**: [`MapLayerTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerTouchEvent/index.md>)

Defined in: [ui/events.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L132>)

Fired when a [`touchstart`](<https://developer.mozilla.org/en-US/docs/Web/Events/touchstart>) event occurs within the visible portion of the specified layer.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### touchend

> **touchend**: [`MapLayerTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerTouchEvent/index.md>)

Defined in: [ui/events.ts:127](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L127>)

Fired when a [`touchend`](<https://developer.mozilla.org/en-US/docs/Web/Events/touchend>) event occurs within the visible portion of the specified layer.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### touchstart

> **touchstart**: [`MapLayerTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerTouchEvent/index.md>)

Defined in: [ui/events.ts:122](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L122>)

Fired when a [`touchstart`](<https://developer.mozilla.org/en-US/docs/Web/Events/touchstart>) event occurs within the visible portion of the specified layer.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

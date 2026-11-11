# MapEventType

> **MapEventType** = `object`

Defined in: [ui/events.ts:152](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L152>)

`MapEventType` - a mapping between the event name and the event value. These events are used with the [Map.on](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#on>) method. When using a `layerId` with [Map.on](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#on>) method, please refer to [MapLayerEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>). The following example can be used for all the events.

## Example

```ts
// Initialize the map
let map = new Map({ // map options });
// Set an event listener
map.on('the-event-name', () => {
  console.log('An event has occurred!');
});
```

## Properties

### boxzoomcancel

> **boxzoomcancel**: [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>)

Defined in: [ui/events.ts:265](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L265>)

Fired when the user cancels a "box zoom" interaction, or when the bounding box does not meet the minimum size threshold. See [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>).

---

### boxzoomend

> **boxzoomend**: [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>)

Defined in: [ui/events.ts:273](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L273>)

Fired when a "box zoom" interaction ends. See [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>).

---

### boxzoomstart

> **boxzoomstart**: [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>)

Defined in: [ui/events.ts:269](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L269>)

Fired when a "box zoom" interaction starts. See [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>).

---

### click

> **click**: [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)

Defined in: [ui/events.ts:299](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L299>)

Fired when a pointing device (usually a mouse) is pressed and released at the same point on the map.

#### See

- [Measure distances](<https://maplibre.org/maplibre-gl-js/docs/examples/measure-distances/>)
- [Center the map on a clicked symbol](<https://maplibre.org/maplibre-gl-js/docs/examples/center-the-map-on-a-clicked-symbol/>)

---

### contextmenu

> **contextmenu**: [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)

Defined in: [ui/events.ts:303](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L303>)

Fired when the right button of the mouse is clicked or the context menu key is pressed within the map.

---

### cooperativegestureprevented

> **cooperativegestureprevented**: [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`WheelEvent` | `TouchEvent`\> &amp; `object`

Defined in: [ui/events.ts:450](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L450>)

Fired whenever the cooperativeGestures option prevents a gesture from being handled by the map. This is useful for showing your own UI when this happens.

#### Type Declaration

##### gestureType

> **gestureType**: `"wheel_zoom"` | `"touch_pan"`

---

### data

> **data**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) | [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>)

Defined in: [ui/events.ts:220](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L220>)

Fired when any map data loads or changes. See [MapSourceDataEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) and [MapStyleDataEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>) for more information.

#### See

[Display HTML clusters with custom properties](<https://maplibre.org/maplibre-gl-js/docs/examples/display-html-clusters-with-custom-properties/>)

---

### dataabort

> **dataabort**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:256](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L256>)

Fired when a request for one of the map's sources' tiles or data is aborted.

---

### dataloading

> **dataloading**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) | [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>)

Defined in: [ui/events.ts:215](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L215>)

Fired when any map data (style, source, tile, etc) begins loading or changing asynchronously. All `dataloading` events are followed by a `data`, `dataabort` or `error` event.

---

### dblclick

> **dblclick**: [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)

Defined in: [ui/events.ts:310](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L310>)

Fired when a pointing device (usually a mouse) is pressed and released twice at the same point on the map in rapid succession.

> [!NOTE]
>
> Under normal conditions, this event will be preceded by two `click` events.

---

### drag

> **drag**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:400](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L400>)

Fired repeatedly during a "drag to pan" interaction. See [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>).

---

### dragend

> **dragend**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:405](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L405>)

Fired when a "drag to pan" interaction ends. See [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>).

#### See

[Create a draggable marker](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-marker/>)

---

### dragstart

> **dragstart**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:396](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L396>)

Fired when a "drag to pan" interaction starts. See [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>).

---

### error

> **error**: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>)

Defined in: [ui/events.ts:159](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L159>)

Fired when an error occurs. This is GL JS's primary error reporting mechanism. We use an event instead of `throw` to better accommodate asynchronous operations. If no listeners are bound to the `error` event, the error will be printed to the console.

---

### idle

> **idle**: [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

Defined in: [ui/events.ts:177](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L177>)

Fired after the last frame rendered before the map enters an "idle" state:

- No camera transitions are in progress
- All currently requested tiles have loaded
- All fade/transition animations have completed

---

### load

> **load**: [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

Defined in: [ui/events.ts:168](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L168>)

Fired immediately after all necessary resources have been downloaded and the first visually complete rendering of the map has occurred.

#### See

- [Draw GeoJSON points](<https://maplibre.org/maplibre-gl-js/docs/examples/draw-geojson-points/>)
- [Add live realtime data](<https://maplibre.org/maplibre-gl-js/docs/examples/add-live-realtime-data/>)
- [Animate a point](<https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-point/>)

---

### mousedown

> **mousedown**: [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)

Defined in: [ui/events.ts:331](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L331>)

Fired when a pointing device (usually a mouse) is pressed within the map.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### mousemove

> **mousemove**: [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)

Defined in: [ui/events.ts:319](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L319>)

Fired when a pointing device (usually a mouse) is moved while the cursor is inside the map. As you move the cursor across the map, the event will fire every time the cursor changes position within the map.

#### See

- [Get coordinates of the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/get-coordinates-of-the-mouse-pointer/>)
- [Highlight features under the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/>)
- [Display a popup on over](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/>)

---

### mouseout

> **mouseout**: [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)

Defined in: [ui/events.ts:335](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L335>)

Fired when a point device (usually a mouse) leaves the map's canvas.

---

### mouseover

> **mouseover**: [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)

Defined in: [ui/events.ts:345](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L345>)

Fired when a pointing device (usually a mouse) is moved within the map. As you move the cursor across a web page containing a map, the event will fire each time it enters the map or any child elements.

#### See

- [Get coordinates of the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/get-coordinates-of-the-mouse-pointer/>)
- [Highlight features under the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/>)
- [Display a popup on hover](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/>)

---

### mouseup

> **mouseup**: [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)

Defined in: [ui/events.ts:325](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L325>)

Fired when a pointing device (usually a mouse) is released within the map.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### move

> **move**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:358](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L358>)

Fired repeatedly during an animated transition from one view to another, as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

#### See

[Display HTML clusters with custom properties](<https://maplibre.org/maplibre-gl-js/docs/examples/display-html-clusters-with-custom-properties/>)

---

### moveend

> **moveend**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:365](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L365>)

Fired just after the map completes a transition from one view to another, as the result of either user interaction or methods such as [Map.jumpTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#jumpto>).

#### See

[Display HTML clusters with custom properties](<https://maplibre.org/maplibre-gl-js/docs/examples/display-html-clusters-with-custom-properties/>)

---

### movestart

> **movestart**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:351](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L351>)

Fired just before the map begins a transition from one view to another, as the result of either user interaction or methods such as [Map.jumpTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#jumpto>).

---

### pitch

> **pitch**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:416](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L416>)

Fired repeatedly during the map's pitch (tilt) animation between one state and another as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

---

### pitchend

> **pitchend**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:421](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L421>)

Fired immediately after the map's pitch (tilt) finishes changing as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

---

### pitchstart

> **pitchstart**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:410](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L410>)

Fired whenever the map's pitch (tilt) begins a change as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>) .

---

### projectiontransition

> **projectiontransition**: [`MapProjectionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>)

Defined in: [ui/events.ts:456](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L456>)

Fired when map's projection is modified in other ways than by map being moved.

---

### remove

> **remove**: [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

Defined in: [ui/events.ts:181](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L181>)

Fired immediately after the map has been removed with [Map.remove](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#remove>).

---

### render

> **render**: [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

Defined in: [ui/events.ts:190](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L190>)

Fired whenever the map is drawn to the screen, as the result of

- a change to the map's position, zoom, pitch, or bearing
- a change to the map's style
- a change to a GeoJSON source
- the loading of a vector tile, GeoJSON file, glyph, or sprite

---

### resize

> **resize**: [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)

Defined in: [ui/events.ts:194](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L194>)

Fired immediately after the map has been resized.

---

### roll

> **roll**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:432](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L432>)

Fired repeatedly during the map's roll animation between one state and another as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

---

### rollend

> **rollend**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:437](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L437>)

Fired immediately after the map's roll finishes changing as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

---

### rollstart

> **rollstart**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:426](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L426>)

Fired whenever the map's roll begins a change as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

---

### rotate

> **rotate**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:388](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L388>)

Fired repeatedly during a "drag to rotate" interaction. See [DragRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>).

---

### rotateend

> **rotateend**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:392](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L392>)

Fired when a "drag to rotate" interaction ends. See [DragRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>).

---

### rotatestart

> **rotatestart**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:384](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L384>)

Fired when a "drag to rotate" interaction starts. See [DragRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>).

---

### sourcedata

> **sourcedata**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:236](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L236>)

Fired when one of the map's sources loads or changes, including if a tile belonging to a source loads or changes.

---

### sourcedataabort

> **sourcedataabort**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:260](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L260>)

Fired when a request for one of the map's sources' data is aborted.

---

### sourcedataloading

> **sourcedataloading**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:225](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L225>)

Fired when one of the map's sources begins loading or changing asynchronously. All `sourcedataloading` events are followed by a `sourcedata`, `sourcedataabort` or `error` event.

---

### style.load

> **style.load**: [`MapStyleLoadEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>)

Defined in: [ui/events.ts:245](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L245>)

Fired once the map's style has fully loaded or changed, after all necessary resources referenced by the style have been requested.

---

### styledata

> **styledata**: [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>)

Defined in: [ui/events.ts:240](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L240>)

Fired when the map's style loads or changes.

---

### styledataloading

> **styledataloading**: [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>)

Defined in: [ui/events.ts:231](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L231>)

Fired when the map's style begins loading or changing asynchronously. All `styledataloading` events are followed by a `styledata` or `error` event.

---

### styleimagemissing

> **styleimagemissing**: [`MapStyleImageMissingEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>)

Defined in: [ui/events.ts:252](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L252>)

Fired when an icon or pattern needed by the style is missing and no missing style image resolver supplies it. To load or generate images on demand, use [Map.setMissingStyleImageResolver](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setmissingstyleimageresolver>). Event listeners cannot resolve the missing image for the current request.

#### See

[Generate and add a missing icon to the map](<https://maplibre.org/maplibre-gl-js/docs/examples/generate-and-add-a-missing-icon-to-the-map/>)

---

### terrain

> **terrain**: [`MapTerrainEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>)

Defined in: [ui/events.ts:445](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L445>)

Fired when terrain is changed

---

### touchcancel

> **touchcancel**: [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>)

Defined in: [ui/events.ts:277](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L277>)

Fired when a [`touchcancel`](<https://developer.mozilla.org/en-US/docs/Web/Events/touchcancel>) event occurs within the map.

---

### touchend

> **touchend**: [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>)

Defined in: [ui/events.ts:287](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L287>)

Fired when a [`touchend`](<https://developer.mozilla.org/en-US/docs/Web/Events/touchend>) event occurs within the map.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### touchmove

> **touchmove**: [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>)

Defined in: [ui/events.ts:282](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L282>)

Fired when a [`touchmove`](<https://developer.mozilla.org/en-US/docs/Web/Events/touchmove>) event occurs within the map.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### touchstart

> **touchstart**: [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>)

Defined in: [ui/events.ts:292](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L292>)

Fired when a [`touchstart`](<https://developer.mozilla.org/en-US/docs/Web/Events/touchstart>) event occurs within the map.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### webglcontextlost

> **webglcontextlost**: [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>)

Defined in: [ui/events.ts:202](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L202>)

Fired when the WebGL context is lost.

The map rebuilds its style once the context is restored. Until the rebuilt style fires `style.load`, [Map.getSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#getsource>) may return `undefined` and changes to sources or layers are not kept, so apply them again on that `style.load` event.

---

### webglcontextrestored

> **webglcontextrestored**: [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>)

Defined in: [ui/events.ts:209](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L209>)

Fired when the WebGL context is restored.

The style is rebuilt asynchronously, so its sources and layers are not available yet when this fires. Wait for the next `style.load` event before using them.

---

### wheel

> **wheel**: [`MapWheelEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>)

Defined in: [ui/events.ts:441](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L441>)

Fired when a [`wheel`](<https://developer.mozilla.org/en-US/docs/Web/Events/wheel>) event occurs within the map.

---

### zoom

> **zoom**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:375](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L375>)

Fired repeatedly during an animated transition from one zoom level to another, as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

---

### zoomend

> **zoomend**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:380](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L380>)

Fired just after the map completes a transition from one zoom level to another, as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

---

### zoomstart

> **zoomstart**: [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)

Defined in: [ui/events.ts:370](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L370>)

Fired just before the map begins a transition from one zoom level to another, as the result of either user interaction or methods such as [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>).

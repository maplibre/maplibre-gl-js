# MapTouchEvent

Defined in: [ui/events.ts:683](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L683>)

`MapTouchEvent` is the event type for touch-related map events.

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`TouchEvent`\>

## Accessors

### defaultPrevented

#### Get Signature

> **get** **defaultPrevented**(): `boolean`

Defined in: [ui/events.ts:738](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L738>)

`true` if `preventDefault` has been called.

##### Returns

`boolean`

## Methods

### preventDefault()

> **preventDefault**(): `void`

Defined in: [ui/events.ts:731](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L731>)

Prevents subsequent default processing of the event by the map.

Calling this method will prevent the following default map behaviors:

- On `touchstart` events, the behavior of [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>)
- On `touchstart` events, the behavior of [TwoFingersTouchZoomRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/index.md>)

#### Returns

`void`

## Properties

### lngLat

> **lngLat**: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [ui/events.ts:702](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L702>)

The geographic location on the map of the center of the touch event points.

---

### lngLats

> **lngLats**: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)\[\]

Defined in: [ui/events.ts:720](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L720>)

The geographical locations on the map corresponding to a [touch event's `touches`](<https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches>) property.

---

### originalEvent

> **originalEvent**: `TouchEvent`

Defined in: [ui/events.ts:697](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L697>)

The DOM event which caused the map event.

#### Overrides

`MapLibreEvent.originalEvent`

---

### point

> **point**: `Point`

Defined in: [ui/events.ts:708](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L708>)

The pixel coordinates of the center of the touch event points, relative to the map and measured from the top left corner.

---

### points

> **points**: `Point`\[\]

Defined in: [ui/events.ts:714](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L714>)

The array of pixel coordinates corresponding to a [touch event's `touches`](<https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches>) property.

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:692](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L692>)

The `Map` object that fired the event.

#### Overrides

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)

---

### type

> **type**: `"touchcancel"` | `"touchend"` | `"touchmove"` | `"touchstart"`

Defined in: [ui/events.ts:687](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L687>)

The event type.

#### Overrides

`MapLibreEvent.type`

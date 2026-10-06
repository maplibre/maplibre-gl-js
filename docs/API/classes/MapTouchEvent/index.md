# MapTouchEvent

Defined in: [ui/events.ts:676](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L676>)

`MapTouchEvent` is the event type for touch-related map events.

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`TouchEvent`\>

## Accessors

### defaultPrevented

#### Get Signature

> **get** **defaultPrevented**(): `boolean`

Defined in: [ui/events.ts:731](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L731>)

`true` if `preventDefault` has been called.

##### Returns

`boolean`

## Methods

### preventDefault()

> **preventDefault**(): `void`

Defined in: [ui/events.ts:724](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L724>)

Prevents subsequent default processing of the event by the map.

Calling this method will prevent the following default map behaviors:

- On `touchstart` events, the behavior of [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>)
- On `touchstart` events, the behavior of [TwoFingersTouchZoomRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/index.md>)

#### Returns

`void`

## Properties

### lngLat

> **lngLat**: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [ui/events.ts:695](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L695>)

The geographic location on the map of the center of the touch event points.

---

### lngLats

> **lngLats**: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)\[\]

Defined in: [ui/events.ts:713](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L713>)

The geographical locations on the map corresponding to a [touch event's `touches`](<https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches>) property.

---

### originalEvent

> **originalEvent**: `TouchEvent`

Defined in: [ui/events.ts:690](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L690>)

The DOM event which caused the map event.

#### Overrides

`MapLibreEvent.originalEvent`

---

### point

> **point**: `Point`

Defined in: [ui/events.ts:701](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L701>)

The pixel coordinates of the center of the touch event points, relative to the map and measured from the top left corner.

---

### points

> **points**: `Point`\[\]

Defined in: [ui/events.ts:707](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L707>)

The array of pixel coordinates corresponding to a [touch event's `touches`](<https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches>) property.

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:685](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L685>)

The `Map` object that fired the event.

#### Overrides

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)

---

### type

> **type**: `"touchcancel"` | `"touchend"` | `"touchmove"` | `"touchstart"`

Defined in: [ui/events.ts:680](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L680>)

The event type.

#### Overrides

`MapLibreEvent.type`

# MapWheelEvent

Defined in: [ui/events.ts:755](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L755>)

`MapWheelEvent` is the event type for the `wheel` map event.

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`WheelEvent`\>

## Accessors

### defaultPrevented

#### Get Signature

> **get** **defaultPrevented**(): `boolean`

Defined in: [ui/events.ts:783](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L783>)

`true` if `preventDefault` has been called.

##### Returns

`boolean`

## Constructors

### Constructor

> **new MapWheelEvent**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>), `originalEvent`: `WheelEvent`): `MapWheelEvent`

Defined in: [ui/events.ts:790](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L790>)

#### Parameters

| Parameter | Type |
| --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) |
| `originalEvent` | `WheelEvent` |

#### Returns

`MapWheelEvent`

#### Overrides

`MapLibreEvent<WheelEvent>.constructor`

## Methods

### preventDefault()

> **preventDefault**(): `void`

Defined in: [ui/events.ts:776](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L776>)

Prevents subsequent default processing of the event by the map.

Calling this method will prevent the behavior of [ScrollZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/index.md>).

#### Returns

`void`

## Properties

### originalEvent

> **originalEvent**: `WheelEvent`

Defined in: [ui/events.ts:769](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L769>)

The DOM event which caused the map event.

#### Overrides

`MapLibreEvent.originalEvent`

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:764](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L764>)

The `Map` object that fired the event.

#### Overrides

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/#target>)

---

### type

> **type**: `"wheel"`

Defined in: [ui/events.ts:759](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/events.ts#L759>)

The event type.

#### Overrides

`MapLibreEvent.type`

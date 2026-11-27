# MapWheelEvent

Defined in: [ui/events.ts:761](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L761>)

`MapWheelEvent` is the event type for the `wheel` map event.

## Extends

- [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`WheelEvent`\>

## Accessors

### defaultPrevented

#### Get Signature

> **get** **defaultPrevented**(): `boolean`

Defined in: [ui/events.ts:789](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L789>)

`true` if `preventDefault` has been called.

##### Returns

`boolean`

## Constructors

### Constructor

> **new MapWheelEvent**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>), `originalEvent`: `WheelEvent`): `MapWheelEvent`

Defined in: [ui/events.ts:796](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L796>)

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

Defined in: [ui/events.ts:782](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L782>)

Prevents subsequent default processing of the event by the map.

Calling this method will prevent the behavior of [ScrollZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/index.md>).

#### Returns

`void`

## Properties

### originalEvent

> **originalEvent**: `WheelEvent`

Defined in: [ui/events.ts:775](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L775>)

The DOM event which caused the map event.

#### Overrides

`MapLibreEvent.originalEvent`

---

### target

> **target**: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

Defined in: [ui/events.ts:770](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L770>)

The `Map` object that fired the event.

#### Overrides

[`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>).[`target`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md#target>)

---

### type

> **type**: `"wheel"`

Defined in: [ui/events.ts:765](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L765>)

The event type.

#### Overrides

`MapLibreEvent.type`

# AttributionControl

Defined in: [ui/control/attribution\_control.ts:40](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/attribution_control.ts#L40>)

An `AttributionControl` control presents the map's attribution information. By default, the attribution control is expanded (regardless of map width).

## Example

```ts
let map = new Map({attributionControl: false})
    .addControl(new AttributionControl({
        compact: true
    }));
```

## See

[Change the default position for attribution](<https://maplibre.org/maplibre-gl-js/docs/examples/change-the-default-position-for-attribution/>)

## Implements

- [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)

## Constructors

### Constructor

> **new AttributionControl**(`options?`: [`AttributionControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AttributionControlOptions/index.md>)): `AttributionControl`

Defined in: [ui/control/attribution\_control.ts:55](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/attribution_control.ts#L55>)

#### Parameters

| Parameter | Type | Default value | Description |
| --- | --- | --- | --- |
| `options` | [`AttributionControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AttributionControlOptions/index.md>) | `defaultAttributionControlOptions` | the attribution options |

#### Returns

`AttributionControl`

## Methods

### getDefaultPosition()

> **getDefaultPosition**(): [`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

Defined in: [ui/control/attribution\_control.ts:59](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/attribution_control.ts#L59>)

Optionally provide a default position for this control. If this method is implemented and [Map.addControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addcontrol>) is called without the `position` parameter, the value returned by getDefaultPosition will be used as the control's position.

#### Returns

[`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

a control position, one of the values valid in addControl.

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`getDefaultPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#getdefaultposition>)

---

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `HTMLElement`

Defined in: [ui/control/attribution\_control.ts:64](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/attribution_control.ts#L64>)

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

### onRemove()

> **onRemove**(): `void`

Defined in: [ui/control/attribution\_control.ts:86](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/attribution_control.ts#L86>)

Unregister a control on the map and give it a chance to detach event listeners and resources. This method is called by [Map.removeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removecontrol>) internally.

#### Returns

`void`

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#onremove>)

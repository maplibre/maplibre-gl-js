# ScaleControl

Defined in: [ui/control/scale\_control.ts:48](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/scale_control.ts#L48>)

A `ScaleControl` control displays the ratio of a distance on the map to the corresponding distance on the ground.

## Example

```ts
let scale = new ScaleControl({
    maxWidth: 80,
    unit: 'imperial'
});
map.addControl(scale);

scale.setUnit('metric');
```

## Implements

- [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)

## Constructors

### Constructor

> **new ScaleControl**(`options?`: [`ScaleControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ScaleControlOptions/index.md>)): `ScaleControl`

Defined in: [ui/control/scale\_control.ts:56](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/scale_control.ts#L56>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`ScaleControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ScaleControlOptions/index.md>) | the control's options |

#### Returns

`ScaleControl`

## Methods

### getDefaultPosition()

> **getDefaultPosition**(): [`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

Defined in: [ui/control/scale\_control.ts:60](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/scale_control.ts#L60>)

Optionally provide a default position for this control. If this method is implemented and [Map.addControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addcontrol>) is called without the `position` parameter, the value returned by getDefaultPosition will be used as the control's position.

#### Returns

[`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

a control position, one of the values valid in addControl.

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`getDefaultPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#getdefaultposition>)

---

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `HTMLElement`

Defined in: [ui/control/scale\_control.ts:69](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/scale_control.ts#L69>)

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

Defined in: [ui/control/scale\_control.ts:80](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/scale_control.ts#L80>)

Unregister a control on the map and give it a chance to detach event listeners and resources. This method is called by [Map.removeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removecontrol>) internally.

#### Returns

`void`

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#onremove>)

---

### setUnit()

> **setUnit**(`unit`: [`Unit`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Unit/index.md>)): `void`

Defined in: [ui/control/scale\_control.ts:91](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/scale_control.ts#L91>)

Set the scale's unit of the distance

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `unit` | [`Unit`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Unit/index.md>) | Unit of the distance (`'imperial'`, `'metric'` or `'nautical'`). |

#### Returns

`void`

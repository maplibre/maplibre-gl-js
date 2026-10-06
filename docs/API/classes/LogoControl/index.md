# LogoControl

Defined in: [ui/control/logo\_control.ts:27](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/logo_control.ts#L27>)

A `LogoControl` is a control that adds the watermark.

## Example

```ts
map.addControl(new LogoControl({compact: false}));
```

## Implements

- [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)

## Constructors

### Constructor

> **new LogoControl**(`options?`: [`LogoControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LogoControlOptions/index.md>)): `LogoControl`

Defined in: [ui/control/logo\_control.ts:36](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/logo_control.ts#L36>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`LogoControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LogoControlOptions/index.md>) | the control's options |

#### Returns

`LogoControl`

## Methods

### getDefaultPosition()

> **getDefaultPosition**(): [`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

Defined in: [ui/control/logo\_control.ts:40](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/logo_control.ts#L40>)

Optionally provide a default position for this control. If this method is implemented and [Map.addControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addcontrol>) is called without the `position` parameter, the value returned by getDefaultPosition will be used as the control's position.

#### Returns

[`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

a control position, one of the values valid in addControl.

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`getDefaultPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#getdefaultposition>)

---

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `HTMLElement`

Defined in: [ui/control/logo\_control.ts:45](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/logo_control.ts#L45>)

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

Defined in: [ui/control/logo\_control.ts:65](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/logo_control.ts#L65>)

Unregister a control on the map and give it a chance to detach event listeners and resources. This method is called by [Map.removeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removecontrol>) internally.

#### Returns

`void`

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#onremove>)

# NavigationControl

Defined in: [ui/control/navigation\_control.ts:51](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/navigation_control.ts#L51>)

A `NavigationControl` control contains zoom buttons and a compass.

## Example

```ts
let nav = new NavigationControl();
map.addControl(nav, 'top-left');
```

## See

[Display map navigation controls](<https://maplibre.org/maplibre-gl-js/docs/examples/display-map-navigation-controls/>)

## Implements

- [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)

## Constructors

### Constructor

> **new NavigationControl**(`options?`: [`NavigationControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/NavigationControlOptions/index.md>)): `NavigationControl`

Defined in: [ui/control/navigation\_control.ts:64](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/navigation_control.ts#L64>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`NavigationControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/NavigationControlOptions/index.md>) | the control's options |

#### Returns

`NavigationControl`

## Methods

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `HTMLElement`

Defined in: [ui/control/navigation\_control.ts:120](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/navigation_control.ts#L120>)

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

Defined in: [ui/control/navigation\_control.ts:144](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/navigation_control.ts#L144>)

Unregister a control on the map and give it a chance to detach event listeners and resources. This method is called by [Map.removeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removecontrol>) internally.

#### Returns

`void`

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#onremove>)

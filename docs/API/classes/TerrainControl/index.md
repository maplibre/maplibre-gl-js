# TerrainControl

Defined in: [ui/control/terrain\_control.ts:24](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/terrain_control.ts#L24>)

A `TerrainControl` control contains a button for turning the terrain on and off.

## Example

```ts
let map = new Map({TerrainControl: false})
    .addControl(new TerrainControl({
        source: "terrain"
    }));
```

## See

- [3D Terrain](<https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/>)
- [Create a Heatmap layer on a globe with terrain elevation](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-heatmap-layer-on-a-globe-with-terrain-elevation/>)
- [Display a hybrid satellite map with terrain elevation](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-hybrid-satellite-map-with-terrain-elevation/>)
- [Sky, Fog, Terrain](<https://maplibre.org/maplibre-gl-js/docs/examples/sky-fog-terrain/>)

## Implements

- [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)

## Constructors

### Constructor

> **new TerrainControl**(`options`: `TerrainSpecification`): `TerrainControl`

Defined in: [ui/control/terrain\_control.ts:33](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/terrain_control.ts#L33>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | `TerrainSpecification` | the control's options |

#### Returns

`TerrainControl`

## Methods

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `HTMLElement`

Defined in: [ui/control/terrain\_control.ts:38](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/terrain_control.ts#L38>)

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

Defined in: [ui/control/terrain\_control.ts:52](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/control/terrain_control.ts#L52>)

Unregister a control on the map and give it a chance to detach event listeners and resources. This method is called by [Map.removeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removecontrol>) internally.

#### Returns

`void`

#### Implementation of

[`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/#onremove>)

# IControl

Defined in: [ui/control/control.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/control.ts#L37>)

Interface for interactive controls added to the map. This is a specification for implementers to model: it is not an exported method or class.

Controls must implement `onAdd` and `onRemove`, and must own an element, which is often a `div` element. To use MapLibre GL JS's default control styling, add the `maplibregl-ctrl` class to your control's node.

## Example

```ts
class HelloWorldControl: IControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl';
        this._container.textContent = 'Hello, world';
        return this._container;
    }

    onRemove() {
        this._container.remove();
        this._map = undefined;
    }
}
```

## Methods

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `HTMLElement`

Defined in: [ui/control/control.ts:49](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/control.ts#L49>)

Register a control on the map and give it a chance to register event listeners and resources. This method is called by [Map.addControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addcontrol>) internally.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | the Map this control will be added to |

#### Returns

`HTMLElement`

The control's container element. This should be created by the control and returned by onAdd without being attached to the DOM: the map will insert the control's element into the DOM as necessary.

---

### onRemove()

> **onRemove**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `void`

Defined in: [ui/control/control.ts:57](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/control.ts#L57>)

Unregister a control on the map and give it a chance to detach event listeners and resources. This method is called by [Map.removeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removecontrol>) internally.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | the Map this control will be removed from |

#### Returns

`void`

## Properties

### getDefaultPosition?

> `readonly` `optional` **getDefaultPosition?**: () =\> [`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

Defined in: [ui/control/control.ts:66](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/control.ts#L66>)

Optionally provide a default position for this control. If this method is implemented and [Map.addControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addcontrol>) is called without the `position` parameter, the value returned by getDefaultPosition will be used as the control's position.

#### Returns

[`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

a control position, one of the values valid in addControl.

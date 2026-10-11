# FitBoundsOptions

> **FitBoundsOptions** = [`FlyToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FlyToOptions/index.md>) &amp; `object`

Defined in: [ui/camera.ts:228](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/ui/camera.ts#L228>)

Options for [Map.fitBounds](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#fitbounds>) method

## Type Declaration

### absolutePadding?

> `optional` **absolutePadding?**: `boolean`

If `true`, `padding` replaces the map's current padding instead of adding to it, and the map transitions to it. This will become the default in version 7.

#### Default Value

```ts
false
```

### linear?

> `optional` **linear?**: `boolean`

If `true`, the map transitions using [Map.easeTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#easeto>). If `false`, the map transitions using [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>). See those functions and [AnimationOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) for information about options available.

#### Default Value

```ts
false
```

### maxZoom?

> `optional` **maxZoom?**: `number`

The maximum zoom level to allow when the map view transitions to the specified bounds.

### offset?

> `optional` **offset?**: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)

The center of the given bounds relative to the map's center, measured in pixels.

#### Default Value

```ts
[0, 0]
```

# FitBoundsOptions

> **FitBoundsOptions** = [`FlyToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FlyToOptions/index.md>) &amp; `object`

Defined in: [ui/camera.ts:202](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/camera.ts#L202>)

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

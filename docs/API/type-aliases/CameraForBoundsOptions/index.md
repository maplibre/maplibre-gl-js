# CameraForBoundsOptions

> **CameraForBoundsOptions** = [`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>) &amp; `object`

Defined in: [ui/camera.ts:133](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/camera.ts#L133>)

A options object for the [Map.cameraForBounds](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#cameraforbounds>) method

## Type Declaration

### absolutePadding?

> `optional` **absolutePadding?**: `boolean`

If `true`, `padding` replaces the map's current padding instead of adding to it, and is returned with the result. This will become the default in version 7.

#### Default Value

```ts
false
```

### maxZoom?

> `optional` **maxZoom?**: `number`

The maximum zoom level to allow when the camera would transition to the specified bounds.

### offset?

> `optional` **offset?**: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)

The center of the given bounds relative to the map's center, measured in pixels.

#### Default Value

```ts
[0, 0]
```

### padding?

> `optional` **padding?**: `number` | [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)

The amount of padding in pixels to add to the given bounds, on top of the map's current padding.

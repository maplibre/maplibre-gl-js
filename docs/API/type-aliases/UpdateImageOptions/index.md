# UpdateImageOptions

> **UpdateImageOptions** = `object` &amp; ({ `url`: `string`; } | { `image`: [`ImageSourceImage`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceImage/index.md>); })

Defined in: [source/image\_source.ts:98](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/source/image_source.ts#L98>)

The options object for the [ImageSource.updateImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#updateimage>) method.

Provide exactly one of `url` (to load an image over the network) or `image` (an already-decoded image to display directly, without a network request).

## Type Declaration

### coordinates?

> `optional` **coordinates?**: [`Coordinates`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Coordinates/index.md>)

The image coordinates

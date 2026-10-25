# UpdateImageOptions

> **UpdateImageOptions** = `object` &amp; ({ `url`: `string`; } | { `image`: [`ImageSourceImage`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ImageSourceImage/index.md>); })

Defined in: [source/image\_source.ts:98](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/source/image_source.ts#L98>)

The options object for the [ImageSource.updateImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#updateimage>) method.

Provide exactly one of `url` (to load an image over the network) or `image` (an already-decoded image to display directly, without a network request).

## Type Declaration

### coordinates?

> `optional` **coordinates?**: [`Coordinates`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Coordinates/index.md>)

The image coordinates

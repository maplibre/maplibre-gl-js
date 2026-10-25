# Offset

> **Offset** = `number` | [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) | `{ [_ in PositionAnchor]: PointLike }`

Defined in: [ui/popup.ts:36](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/popup.ts#L36>)

A pixel offset specified as:

- A single number specifying a distance from the location
- A [PointLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) specifying a constant offset
- An object of [PointLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)s specifying an offset for each anchor position

Negative offsets indicate left and up.

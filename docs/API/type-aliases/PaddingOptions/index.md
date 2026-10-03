# PaddingOptions

> **PaddingOptions** = [`RequireAtLeastOne`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequireAtLeastOne/index.md>)\<{ `bottom`: `number`; `left`: `number`; `right`: `number`; `top`: `number`; }\>

Defined in: [geo/edge\_insets.ts:129](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L129>)

Options for setting padding on calls to methods such as [Map.fitBounds](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#fitbounds>), [Map.fitScreenCoordinates](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#fitscreencoordinates>), and [Map.setPadding](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setpadding>). Adjust these options to set the amount of padding in pixels added to the edges of the canvas. Set a uniform padding on all edges or individual values for each edge. All properties of this object must be non-negative integers.

## Examples

```ts
let bbox = [[-79, 43], [-73, 45]];
map.fitBounds(bbox, {
  padding: {top: 10, bottom:25, left: 15, right: 5}
});
```

```ts
let bbox = [[-79, 43], [-73, 45]];
map.fitBounds(bbox, {
  padding: 20
});
```

## See

- [Fit to the bounds of a LineString](<https://maplibre.org/maplibre-gl-js/docs/examples/zoomto-linestring/>)
- [Fit a map to a bounding box](<https://maplibre.org/maplibre-gl-js/docs/examples/fitbounds/>)

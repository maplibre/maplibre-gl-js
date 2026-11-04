# Tapered lines

Tapered lines render a `line` layer whose width varies along the line. Two
mechanisms are available, and they can be combined:

- **`line-width-start` / `line-width-end`** — the width interpolates linearly
  between a start and an end value along each line.
- **`line-widths`** — a data-driven array with one width per vertex, so the
  width at every vertex of the line can be set exactly.

## Properties

All three properties are data-driven and interpolable:

| Property | Type | Description |
| --- | --- | --- |
| `line-width-start` | number | Width at the start of the line. Default `-1` (unset). |
| `line-width-end` | number | Width at the end of the line. Default `-1` (unset). |
| `line-widths` | number[] | One width per vertex, taking precedence over the start/end values. Default `[]` (unset). |

For the start/end properties, an unset side falls back to the regular
`line-width`. For `line-widths`, each entry is applied at the matching vertex
and interpolated along the geometry in between; if the array length does not
match the vertex count (e.g. after geometry simplification), it is treated as
evenly spaced stops.

## Usage

```js
map.addLayer({
  id: 'taper',
  type: 'line',
  source: 'route',
  paint: {
    'line-color': '#e11',
    'line-width': 2,          // width at the end (fallback)
    'line-width-start': 16,   // width at the start
    'line-width-end': 2       // optional: explicit end width
  }
});
```

Both taper widths are data-driven, so they can also be per feature or zoom
dependent:

```js
paint: {
  'line-width-start': ['get', 'width_at_start'],
  'line-width-end': ['interpolate', ['linear'], ['zoom'],
      0, 2,
      20, 12
  ]
}
```

## Per-vertex widths

For exact control at every vertex, use `line-widths` with one entry per vertex
of the feature:

```js
// Feature:
{
  type: 'Feature',
  properties: {widths: [20, 4, 12, 2]},
  geometry: {type: 'LineString', coordinates: [[-10, 3], [-3, 6], [3, 1], [10, 4]]}
}

// Style:
paint: {
  'line-width': 2,
  'line-widths': ['get', 'widths']
}
```

`line-widths` takes precedence over `line-width-start`/`line-width-end`. Each
value is applied at the matching vertex and interpolated along the actual
geometry in between, so a value given at a vertex is reproduced exactly there.

## Notes

- Only where the line is actually drawn is hit-testable:
  `queryRenderedFeatures` matches against the real tapered shape, so a click at
  the thin end of a line that was previously within the widest width no longer
  registers a hit.
- The geometry (per-vertex taper factor) is a property of the tile bucket, not
  of the start/end widths. Animating `line-width-start`/`line-width-end` is
  cheap and does not rebuild the line geometry.

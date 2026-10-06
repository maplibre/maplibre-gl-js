# ImageSourceWarp

> **ImageSourceWarp** = `"auto"` | `"perspective"` | `"flat"`

Defined in: [source/image\_source.ts:83](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/image_source.ts#L83>)

**`Experimental`**

How an [ImageSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>) warps its image onto its four coordinates, for the cases where the coordinates do not form a rectangle.

- `perspective` maps the image as the perspective view of a plane, which is what georeferenced photography and any other image of a flat scene wants: straight lines in the image stay straight, and the image foreshortens towards its more distant edge.
- `flat` interpolates the image between the four coordinates bilinearly, pinning it like a rubber sheet, which is what an image being reshaped by hand wants: every corner moves the image only near itself, and the result is stable no matter how far a corner is dragged. Straight lines in the image only stay straight while they run parallel to its edges, and there is no foreshortening, in the same sense as the CSS `transform-style: flat`.
- `auto`, the default, is `perspective` while the coordinates plausibly describe a perspective view, and blends continuously towards `flat` as they stop doing so, which they do as a corner approaches the diagonal between its two neighbours.

Coordinates with no perspective view at all - a concave, self-crossing or collinear quad - are always warped flat, whichever of these is set.

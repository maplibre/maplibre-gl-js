# EXTENT

> `const` **EXTENT**: `8192` = `8192`

Defined in: [data/extent.ts:13](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/data/extent.ts#L13>)

The maximum value of a coordinate in the internal tile coordinate system. Coordinates of all source features normalized to this extent upon load.

The value is a consequence of the following:

- Vertex buffer store positions as signed 16 bit integers.
- One bit is lost for signedness to support tile buffers.
- One bit is lost because the line vertex buffer used to pack 1 bit of other data into the int.
- One bit is lost to support features extending past the extent on the right edge of the tile.
- This leaves us with 2^13 = 8192

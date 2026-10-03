# CreateTileMeshOptions

> **CreateTileMeshOptions** = `object`

Defined in: [util/create\_tile\_mesh.ts:23](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/create_tile_mesh.ts#L23>)

Options for generating a tile mesh. Can optionally configure any of the following: - mesh subdivision granularity - border presence - special geometry for the north and/or south pole

## Properties

### extendToNorthPole?

> `optional` **extendToNorthPole?**: `boolean`

Defined in: [util/create\_tile\_mesh.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/create_tile_mesh.ts#L37>)

When true, additional geometry is generated along the north edge of the mesh, connecting it to the pole special vertex position. This geometry replaces the mesh border along this edge, if one is present.

---

### extendToSouthPole?

> `optional` **extendToSouthPole?**: `boolean`

Defined in: [util/create\_tile\_mesh.ts:42](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/create_tile_mesh.ts#L42>)

When true, additional geometry is generated along the south edge of the mesh, connecting it to the pole special vertex position. This geometry replaces the mesh border along this edge, if one is present.

---

### generateBorders?

> `optional` **generateBorders?**: `boolean`

Defined in: [util/create\_tile\_mesh.ts:32](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/create_tile_mesh.ts#L32>)

When true, an additional ring of quads is generated along the border, always extending `EXTENT_STENCIL_BORDER` units away from the main mesh.

---

### granularity?

> `optional` **granularity?**: `number`

Defined in: [util/create\_tile\_mesh.ts:28](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/create_tile_mesh.ts#L28>)

Specifies how much should the tile mesh be subdivided. A value of 1 leads to a simple quad, a value of 4 will result in a grid of 4x4 quads.

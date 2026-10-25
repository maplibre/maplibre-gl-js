# createTileMesh()

> **createTileMesh**(`options`: [`CreateTileMeshOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CreateTileMeshOptions/index.md>), `forceIndicesSize?`: [`IndicesType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/IndicesType/index.md>)): [`TileMesh`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TileMesh/index.md>)

Defined in: [util/create\_tile\_mesh.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/create_tile_mesh.ts#L117>)

Creates a mesh of a quad that covers the entire tile (covering positions in range 0..EXTENT), is optionally subdivided into finer quads, optionally includes a border and optionally extends to the north and/or special pole vertices. Additionally the resulting mesh indices type can be specified using `forceIndicesSize`.

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`CreateTileMeshOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CreateTileMeshOptions/index.md>) | Specify options for tile mesh creation such as granularity or border. |
| `forceIndicesSize?` | [`IndicesType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/IndicesType/index.md>) | Specifies what indices type to use. The values '32bit' and '16bit' force their respective indices size. If undefined, the mesh may use either size, and will pick 16 bit indices if possible. If '16bit' is specified and the mesh exceeds 65536 vertices, an exception is thrown. |

## Returns

[`TileMesh`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TileMesh/index.md>)

Typed arrays of the mesh vertices and indices.

## Example

```text
// Creating a mesh for a tile that can be used for raster layers, hillshade, etc.
const meshBuffers = createTileMesh({
    granularity: map.style.projection.subdivisionGranularity.tile.getGranularityForZoomLevel(tileID.z),
    generateBorders: true,
    extendToNorthPole: tileID.y === 0,
    extendToSouthPole: tileID.y === (1 << tileID.z) - 1,
}, '16bit');
```

## See

[Add a custom layer with tiles to a globe](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-custom-layer-with-tiles-to-a-globe/>)

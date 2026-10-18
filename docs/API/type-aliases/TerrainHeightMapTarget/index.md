# TerrainHeightMapTarget

> **TerrainHeightMapTarget** = `object`

Defined in: [render/terrain.ts:31](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/render/terrain.ts#L31>)

**`Experimental`**

A float texture for [CustomRenderMethodInput.renderTerrainHeightMap](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomRenderMethodInput/#renderterrainheightmap>), such as `RGBA32F`, which needs the `EXT_color_buffer_float` extension to be drawn into. Red holds the elevation in meters, including the terrain exaggeration, alpha is 1 where terrain is loaded and 0 elsewhere, and the first row is the south edge.

## Properties

### bounds

> **bounds**: \[`number`, `number`, `number`, `number`\]

Defined in: [render/terrain.ts:39](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/render/terrain.ts#L39>)

The area to draw, `[minX, minY, maxX, maxY]` in [MercatorCoordinate](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MercatorCoordinate/index.md>) units, with x counting world copies.

---

### height

> **height**: `number`

Defined in: [render/terrain.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/render/terrain.ts#L37>)

The height of the texture in pixels.

---

### texture

> **texture**: `WebGLTexture`

Defined in: [render/terrain.ts:33](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/render/terrain.ts#L33>)

A texture in the map's WebGL context.

---

### width

> **width**: `number`

Defined in: [render/terrain.ts:35](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/render/terrain.ts#L35>)

The width of the texture in pixels.

# CustomRenderMethodInput

> **CustomRenderMethodInput** = `object`

Defined in: [style/style\_layer/custom\_style\_layer.ts:57](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L57>)

Input arguments exposed by custom render function.

## Properties

### defaultProjectionData

> **defaultProjectionData**: [`CustomLayerProjectionData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomLayerProjectionData/index.md>)

Defined in: [style/style\_layer/custom\_style\_layer.ts:154](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L154>)

Uniforms that should be passed to the vertex shader, if MapLibre's projection code is used. For more details of this object's internals, see its doc comments in `src/geo/projection/projection_data.ts`.

These uniforms are set so that `projectTile` in shader accepts a vec2 in range 0..1 in web mercator coordinates. Use `getProjectionData({overscaledTileID: tileID})` to get uniforms for a given tile and pass vec2 in tile-local range 0..EXTENT instead.

For projection 3D features, use `projectTileFor3D` in the shader.

If you just need a projection matrix, use `defaultProjectionData.mainMatrix`. A projection matrix is sufficient for simple custom layers that only support mercator projection.

Under mercator projection, when these uniforms are used, the shader's `projectTile` function projects spherical mercator coordinates to gl clip space coordinates. The spherical mercator coordinate `[0, 0]` represents the top left corner of the mercator world and `[1, 1]` represents the bottom right corner. When the `renderingMode` is `"3d"`, the z coordinate is conformal. A box with identical x, y, and z lengths in mercator units would be rendered as a cube. [MercatorCoordinate.fromLngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MercatorCoordinate/#fromlnglat>) can be used to project a `LngLat` to a mercator coordinate.

Under globe projection, when these uniforms are used, the `elevation` parameter passed to `projectTileFor3D` in the shader is elevation in meters above "sea level", or more accurately for globe, elevation above the surface of the perfect sphere used to render the planet.

---

### farZ

> **farZ**: `number`

Defined in: [style/style\_layer/custom\_style\_layer.ts:63](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L63>)

This value represents the distance from the camera to the far clipping plane. It is used in the calculation of the projection matrix to determine which objects are visible. farZ should be larger than nearZ.

---

### fov

> **fov**: `number`

Defined in: [style/style\_layer/custom\_style\_layer.ts:73](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L73>)

Vertical field of view in radians.

---

### getProjectionData

> **getProjectionData**: (`params`: [`CustomLayerProjectionDataParams`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomLayerProjectionDataParams/index.md>)) =\> [`RendererProjectionData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RendererProjectionData/index.md>)

Defined in: [style/style\_layer/custom\_style\_layer.ts:163](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L163>)

Generates a [ProjectionData](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ProjectionData/index.md>) instance to be used while rendering a given tile. In custom layers, this function is only needed when rendering tiles in a completely custom way and with shaders that are compatible with both projections.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `params` | [`CustomLayerProjectionDataParams`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomLayerProjectionDataParams/index.md>) | Parameters for the projection data generation. |

#### Returns

[`RendererProjectionData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RendererProjectionData/index.md>)

#### See

[Add a custom layer with tiles to a globe](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-custom-layer-with-tiles-to-a-globe>)

---

### modelViewProjectionMatrix

> **modelViewProjectionMatrix**: `mat4`

Defined in: [style/style\_layer/custom\_style\_layer.ts:79](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L79>)

Model view projection matrix. Represents the matrix converting from world space to clip space. https://learnopengl.com/Getting-started/Coordinate-Systems \*

---

### nearZ

> **nearZ**: `number`

Defined in: [style/style\_layer/custom\_style\_layer.ts:69](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L69>)

This value represents the distance from the camera to the near clipping plane. It is used in the calculation of the projection matrix to determine which objects are visible. nearZ should be smaller than farZ.

---

### projectionMatrix

> **projectionMatrix**: `mat4`

Defined in: [style/style\_layer/custom\_style\_layer.ts:85](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L85>)

Projection matrix. Represents the matrix converting from view space to clip space. https://learnopengl.com/Getting-started/Coordinate-Systems

---

### renderTerrainHeightMap?

> `optional` **renderTerrainHeightMap?**: (`target`: [`TerrainHeightMapTarget`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TerrainHeightMapTarget/index.md>)) =\> `void`

Defined in: [style/style\_layer/custom\_style\_layer.ts:171](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L171>)

**`Experimental`**

Draws the elevation of the terrain as the map draws it into a texture, so that the layer can place many objects on the ground on the GPU. Only set in [CustomLayerInterface.prerender](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/#prerender>), while terrain is enabled. Call it again after the camera moves, terrain tiles load or the terrain changes, and set up your WebGL state afterwards.

#### Parameters

| Parameter | Type |
| --- | --- |
| `target` | [`TerrainHeightMapTarget`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TerrainHeightMapTarget/index.md>) |

#### Returns

`void`

---

### shaderData

> **shaderData**: `object`

Defined in: [style/style\_layer/custom\_style\_layer.ts:89](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_layer/custom_style_layer.ts#L89>)

Data required for picking and compiling a custom shader for the current projection.

#### define

> **define**: `string`

Defines to add to the shader code. Depends on current projection.

##### Example

```text
const vertexSource = `#version 300 es
${shaderData.vertexShaderPrelude}
${shaderData.define}
in vec2 a_pos;
void main() {
    gl_Position = projectTile(a_pos);
    #ifdef GLOBE
    // Do globe-specific things
    #endif
}`;
```

#### variantName

> **variantName**: `string`

Name of the shader variant that should be used. Depends on current projection. Whenever the other shader properties change, this string changes as well, and can be used as a key with which to cache compiled shaders.

#### vertexShaderPrelude

> **vertexShaderPrelude**: `string`

The prelude code to add to the vertex shader to access MapLibre's `projectTile` projection function. Depends on current projection.

##### Example

```text
const vertexSource = `#version 300 es
${shaderData.vertexShaderPrelude}
${shaderData.define}
in vec2 a_pos;
void main() {
    gl_Position = projectTile(a_pos);
}`;
```

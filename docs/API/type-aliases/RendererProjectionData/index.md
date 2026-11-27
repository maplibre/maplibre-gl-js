# RendererProjectionData

> **RendererProjectionData** = [`ProjectionData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ProjectionData/index.md>)\<[`Mat4f32`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Mat4f32/index.md>)\> & `object`

Defined in: [geo/projection/projection\_data.ts:11](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/geo/projection/projection_data.ts#L11>)

Projection data used by renderer shader uniforms. Renderer matrices are stored as 32-bit floats so WebGL can consume them directly without per-upload copies.

## Type Declaration

### uniformBufferKey?

> `optional` **uniformBufferKey?**: `string`

Draws of one frame with the same key share one uniform buffer.

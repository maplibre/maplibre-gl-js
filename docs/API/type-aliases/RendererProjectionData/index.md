# RendererProjectionData

> **RendererProjectionData** = [`ProjectionData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ProjectionData/index.md>)\<[`Mat4f32`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Mat4f32/index.md>)\> &amp; `object`

Defined in: [geo/projection/projection\_data.ts:11](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/geo/projection/projection_data.ts#L11>)

Projection data used by renderer shader uniforms. Renderer matrices are stored as 32-bit floats so WebGL can consume them directly without per-upload copies.

## Type Declaration

### uniformBufferKey?

> `optional` **uniformBufferKey?**: `string`

Draws of one frame with the same key share one uniform buffer.

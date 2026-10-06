# CustomLayerProjectionData

> **CustomLayerProjectionData** = [`ProjectionData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ProjectionData/index.md>)\<`ProjectionMatrix`, `ProjectionMatrix`\>

Defined in: [geo/projection/projection\_data.ts:21](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/projection_data.ts#L21>)

Projection data exposed to custom layers. Some matrices are stored as 64-bit floats so custom layer code can apply additional CPU-side transforms before converting to 32-bit floats for WebGL upload when necessary.

# CustomLayerProjectionData

> **CustomLayerProjectionData** = [`ProjectionData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ProjectionData/index.md>)\<`ProjectionMatrix`, `ProjectionMatrix`\>

Defined in: [geo/projection/projection\_data.ts:21](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/projection/projection_data.ts#L21>)

Projection data exposed to custom layers. Some matrices are stored as 64-bit floats so custom layer code can apply additional CPU-side transforms before converting to 32-bit floats for WebGL upload when necessary.

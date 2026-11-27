# AddLayerObject

> **AddLayerObject** = [`LayerSpecification`](<https://maplibre.org/maplibre-style-spec/layers/>) | `Omit`\<[`LayerSpecification`](<https://maplibre.org/maplibre-style-spec/layers/>), `"source"`\> & `object` | [`CustomLayerInterface`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/index.md>)

Defined in: [style/style.ts:208](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style.ts#L208>)

Specifies a layer to be added to a [Style](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Style/index.md>). In addition to a standard [LayerSpecification](<https://maplibre.org/maplibre-style-spec/layers/>) or a [CustomLayerInterface](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/index.md>), a [LayerSpecification](<https://maplibre.org/maplibre-style-spec/layers/>) with an embedded [SourceSpecification](<https://maplibre.org/maplibre-style-spec/sources/>) can also be provided.

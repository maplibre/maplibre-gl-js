# AddLayerObject

> **AddLayerObject** = [`LayerSpecification`](<https://maplibre.org/maplibre-style-spec/layers/>) | `Omit`\<[`LayerSpecification`](<https://maplibre.org/maplibre-style-spec/layers/>), `"source"`\> &amp; `object` | [`CustomLayerInterface`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/index.md>)

Defined in: [style/style.ts:207](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/style/style.ts#L207>)

Specifies a layer to be added to a [Style](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Style/index.md>). In addition to a standard [LayerSpecification](<https://maplibre.org/maplibre-style-spec/layers/>) or a [CustomLayerInterface](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/index.md>), a [LayerSpecification](<https://maplibre.org/maplibre-style-spec/layers/>) with an embedded [SourceSpecification](<https://maplibre.org/maplibre-style-spec/sources/>) can also be provided.

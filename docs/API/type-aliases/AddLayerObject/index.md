# AddLayerObject

> **AddLayerObject** = [`LayerSpecification`](<https://maplibre.org/maplibre-style-spec/layers/>) | `Omit`\<[`LayerSpecification`](<https://maplibre.org/maplibre-style-spec/layers/>), `"source"`\> &amp; `object` | [`CustomLayerInterface`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/index.md>)

Defined in: [style/style.ts:199](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style.ts#L199>)

Specifies a layer to be added to a [Style](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Style/index.md>). In addition to a standard [LayerSpecification](<https://maplibre.org/maplibre-style-spec/layers/>) or a [CustomLayerInterface](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/index.md>), a [LayerSpecification](<https://maplibre.org/maplibre-style-spec/layers/>) with an embedded [SourceSpecification](<https://maplibre.org/maplibre-style-spec/sources/>) can also be provided.

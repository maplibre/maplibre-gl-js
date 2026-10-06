# addSourceType()

> **addSourceType**(`name`: `string`, `SourceType`: [`SourceClass`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceClass/index.md>)): `Promise`\<`void`\>

Defined in: [source/source.ts:193](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/source.ts#L193>)

Adds a custom source type, making it available for use with [Map.addSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addsource>).

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the source type; source definition objects use this name in the `{type: ...}` field. |
| `SourceType` | [`SourceClass`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceClass/index.md>) | A [SourceClass](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceClass/index.md>) - which is a constructor for the `Source` interface. |

## Returns

`Promise`\<`void`\>

a promise that is resolved when the source type is ready or rejected with an error.

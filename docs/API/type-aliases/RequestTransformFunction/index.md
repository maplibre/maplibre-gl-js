# RequestTransformFunction

> **RequestTransformFunction** = (`url`: `string`, `resourceType?`: [`ResourceType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/ResourceType/index.md>)) =\> [`RequestParameters`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/index.md>) | `Promise`\<[`RequestParameters`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/index.md>)\> | `undefined`

Defined in: [util/request\_manager.ts:21](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/request_manager.ts#L21>)

This function is used to transform a request. It is used just before executing the relevant request.

## Parameters

| Parameter | Type |
| --- | --- |
| `url` | `string` |
| `resourceType?` | [`ResourceType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/ResourceType/index.md>) |

## Returns

[`RequestParameters`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/index.md>) | `Promise`\<[`RequestParameters`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/index.md>)\> | `undefined`

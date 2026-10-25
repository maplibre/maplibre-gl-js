# AddProtocolAction

> **AddProtocolAction** = (`requestParameters`: [`RequestParameters`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/index.md>), `abortController`: `AbortController`) =\> `Promise`\<[`GetResourceResponse`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GetResourceResponse/index.md>)\<[`AddProtocolResponseData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddProtocolResponseData/index.md>)\>\>

Defined in: [util/config.ts:20](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/config.ts#L20>)

This method type is used to register a protocol handler. Use the abort controller for aborting requests. Return a promise with the relevant resource response, see [AddProtocolResponseData](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddProtocolResponseData/index.md>) for what `data` may hold.

## Parameters

| Parameter | Type |
| --- | --- |
| `requestParameters` | [`RequestParameters`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/index.md>) |
| `abortController` | `AbortController` |

## Returns

`Promise`\<[`GetResourceResponse`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GetResourceResponse/index.md>)\<[`AddProtocolResponseData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddProtocolResponseData/index.md>)\>\>

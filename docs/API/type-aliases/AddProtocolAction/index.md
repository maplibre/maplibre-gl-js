# AddProtocolAction

> **AddProtocolAction** = (`requestParameters`: [`RequestParameters`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/index.md>), `abortController`: `AbortController`) =\> `Promise`\<[`GetResourceResponse`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GetResourceResponse/index.md>)\<[`AddProtocolResponseData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddProtocolResponseData/index.md>)\>\>

Defined in: [util/config.ts:20](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/config.ts#L20>)

This method type is used to register a protocol handler. Use the abort controller for aborting requests. Return a promise with the relevant resource response, see [AddProtocolResponseData](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddProtocolResponseData/index.md>) for what `data` may hold.

## Parameters

| Parameter | Type |
| --- | --- |
| `requestParameters` | [`RequestParameters`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestParameters/index.md>) |
| `abortController` | `AbortController` |

## Returns

`Promise`\<[`GetResourceResponse`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GetResourceResponse/index.md>)\<[`AddProtocolResponseData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddProtocolResponseData/index.md>)\>\>

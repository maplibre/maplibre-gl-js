# CustomMessageHandler\<TData, TResult\>

> **CustomMessageHandler**\<`TData`, `TResult`\> = (`mapId`: `string` | `number`, `params`: `TData`, `abortController?`: `AbortController`) =\> `Promise`\<`TResult`\>

Defined in: [util/global\_dispatcher.ts:36](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/global_dispatcher.ts#L36>)

A handler for a message that is not one of the built-in [MessageType](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>)s, e.g. a message that is sent by a plugin.

## Type Parameters

| Type Parameter |
| --- |
| `TData` |
| `TResult` |

## Parameters

| Parameter | Type |
| --- | --- |
| `mapId` | `string` \| `number` |
| `params` | `TData` |
| `abortController?` | `AbortController` |

## Returns

`Promise`\<`TResult`\>

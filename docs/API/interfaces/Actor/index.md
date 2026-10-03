# Actor

Defined in: [util/actor.ts:58](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/actor.ts#L58>)

An implementation of the [Actor design pattern](<https://en.wikipedia.org/wiki/Actor_model>) that maintains the relationship between asynchronous tasks and the objects that spin them off - in this case, tasks like parsing parts of styles, owned by the styles

## Implements

- [`IActor`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IActor/index.md>)

## Methods

### sendAsync()

> **sendAsync**\<`T` *extends* [`MessageType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>)\>(`message`: [`ActorMessage`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ActorMessage/index.md>)\<`T`\>, `abortController?`: `AbortController`): `Promise`\<[`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`1`\]\>

Defined in: [util/actor.ts:103](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/actor.ts#L103>)

Sends a message from a main-thread map to a Worker or from a Worker back to a main-thread map instance.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* [`MessageType`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/MessageType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `message` | [`ActorMessage`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ActorMessage/index.md>)\<`T`\> | the message to send |
| `abortController?` | `AbortController` | an optional AbortController to abort the request |

#### Returns

`Promise`\<[`RequestResponseMessageMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestResponseMessageMap/index.md>)\[`T`\]\[`1`\]\>

a promise that will be resolved with the response data

#### Implementation of

`IActor.sendAsync`

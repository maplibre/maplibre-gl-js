# TrustedTypesPolicy

> **TrustedTypesPolicy** = `object`

Defined in: [util/trusted\_types.ts:4](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/util/trusted_types.ts#L4>)

The methods of a [`TrustedTypePolicy`](<https://developer.mozilla.org/en-US/docs/Web/API/TrustedTypePolicy>) that the library calls.

## Properties

### createHTML

> **createHTML**: (`input`: `string`) =\> `unknown`

Defined in: [util/trusted\_types.ts:6](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/util/trusted_types.ts#L6>)

Receives the attribution of a source, which is sanitized after it is parsed.

#### Parameters

| Parameter | Type |
| --- | --- |
| `input` | `string` |

#### Returns

`unknown`

---

### createScriptURL

> **createScriptURL**: (`input`: `string`) =\> `unknown`

Defined in: [util/trusted\_types.ts:8](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/util/trusted_types.ts#L8>)

Receives the URL the workers start from, which is a `blob:` URL when the worker is on another origin.

#### Parameters

| Parameter | Type |
| --- | --- |
| `input` | `string` |

#### Returns

`unknown`

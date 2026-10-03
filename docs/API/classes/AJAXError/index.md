# AJAXError

Defined in: [util/ajax.ts:91](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L91>)

An error thrown when a HTTP request results in an error response.

## Extends

- `Error`

## Constructors

### Constructor

> **new AJAXError**(`status`: `number`, `statusText`: `string`, `url`: `string`, `body`: `Blob`): `AJAXError`

Defined in: [util/ajax.ts:118](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L118>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `status` | `number` | The response's HTTP status code. |
| `statusText` | `string` | The response's HTTP status text. |
| `url` | `string` | The request's URL. |
| `body` | `Blob` | The response's body. |

#### Returns

`AJAXError`

#### Overrides

`Error.constructor`

## Properties

### body

> **body**: `Blob`

Defined in: [util/ajax.ts:110](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L110>)

The response's body.

---

### status

> **status**: `number`

Defined in: [util/ajax.ts:95](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L95>)

The response's HTTP status code.

---

### statusText

> **statusText**: `string`

Defined in: [util/ajax.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L100>)

The response's HTTP status text.

---

### url

> **url**: `string`

Defined in: [util/ajax.ts:105](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L105>)

The request's URL.

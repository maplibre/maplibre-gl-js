# RequestParameters

> **RequestParameters** = `object`

Defined in: [util/ajax.ts:32](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L32>)

A `RequestParameters` object to be returned from Map.options.transformRequest callbacks.

## Example

```ts
// use transformRequest to modify requests that begin with `http://myHost`
transformRequest: function(url, resourceType) {
 if (resourceType === 'Source' && url.indexOf('http://myHost') > -1) {
   return {
     url: url.replace('http', 'https'),
     headers: { 'my-custom-header': true },
     credentials: 'include'  // Include cookies for cross-origin requests
   }
  }
}
```

## Properties

### body?

> `optional` **body?**: `string`

Defined in: [util/ajax.ts:48](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L48>)

Request body.

---

### cache?

> `optional` **cache?**: `RequestCache`

Defined in: [util/ajax.ts:64](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L64>)

Parameters supported only by browser fetch API. Property of the Request interface contains the cache mode of the request. It controls how the request will interact with the browser's HTTP cache. (https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)

---

### collectResourceTiming?

> `optional` **collectResourceTiming?**: `boolean`

Defined in: [util/ajax.ts:60](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L60>)

If `true`, Resource Timing API information will be collected for these transformed requests and returned in a resourceTiming property of relevant data events.

---

### credentials?

> `optional` **credentials?**: `"same-origin"` | `"include"`

Defined in: [util/ajax.ts:56](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L56>)

`'same-origin'|'include'` Use 'include' to send cookies with cross-origin requests.

---

### headers?

> `optional` **headers?**: `any`

Defined in: [util/ajax.ts:40](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L40>)

The headers to be sent with the request.

---

### method?

> `optional` **method?**: `"GET"` | `"POST"` | `"PUT"`

Defined in: [util/ajax.ts:44](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L44>)

Request method `'GET' | 'POST' | 'PUT'`.

---

### referrerPolicy?

> `optional` **referrerPolicy?**: `ReferrerPolicy`

Defined in: [util/ajax.ts:68](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L68>)

The referrer policy to use for the request. Controls how much referrer information is sent. (https://developer.mozilla.org/en-US/docs/Web/API/Request/referrerPolicy)

---

### type?

> `optional` **type?**: `"string"` | `"json"` | `"arrayBuffer"` | `"image"`

Defined in: [util/ajax.ts:52](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L52>)

Response body type to be returned.

---

### url

> **url**: `string`

Defined in: [util/ajax.ts:36](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/ajax.ts#L36>)

The URL to be requested.

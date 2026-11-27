# setTrustedTypesPolicy()

> **setTrustedTypesPolicy**(`policy`: [`TrustedTypesPolicy`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TrustedTypesPolicy/index.md>)): `void`

Defined in: [util/trusted\_types.ts:30](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/trusted_types.ts#L30>)

Sets the policy the library creates its trusted values with, for a page that enforces [Trusted Types](<https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API>). Call it before creating a map.

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `policy` | [`TrustedTypesPolicy`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TrustedTypesPolicy/index.md>) | A policy from `trustedTypes.createPolicy`, or `undefined` to remove it. |

## Returns

`void`

## Example

```ts
setTrustedTypesPolicy(trustedTypes.createPolicy('my-map', {
    createHTML: (html) => html,
    createScriptURL: (url) => {
        if (!new URL(url, location.href).href.startsWith(`${location.origin}/`)) throw new TypeError(`Blocked script URL ${url}`);
        return url;
    }
}));
```

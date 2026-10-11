# RequireAtLeastOne\<T\>

> **RequireAtLeastOne**\<`T`\> = `{ [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>> }`\[keyof `T`\]

Defined in: [util/util.ts:1107](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/util/util.ts#L1107>)

A helper to allow require of at least one property

## Type Parameters

| Type Parameter |
| --- |
| `T` |

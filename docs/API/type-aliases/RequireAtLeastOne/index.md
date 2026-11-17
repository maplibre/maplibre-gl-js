# RequireAtLeastOne\<T\>

> **RequireAtLeastOne**\<`T`\> = `{ [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>> }`\[keyof `T`\]

Defined in: [util/util.ts:1107](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/util/util.ts#L1107>)

A helper to allow require of at least one property

## Type Parameters

| Type Parameter |
| --- |
| `T` |

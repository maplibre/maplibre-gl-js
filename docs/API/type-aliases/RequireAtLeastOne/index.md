# RequireAtLeastOne\<T\>

> **RequireAtLeastOne**\<`T`\> = `{ [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>> }`\[keyof `T`\]

Defined in: [util/util.ts:1107](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/util/util.ts#L1107>)

A helper to allow require of at least one property

## Type Parameters

| Type Parameter |
| --- |
| `T` |

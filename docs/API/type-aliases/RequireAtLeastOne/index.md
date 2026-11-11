# RequireAtLeastOne\<T\>

> **RequireAtLeastOne**\<`T`\> = `{ [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>> }`\[keyof `T`\]

Defined in: [util/util.ts:1107](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/util.ts#L1107>)

A helper to allow require of at least one property

## Type Parameters

| Type Parameter |
| --- |
| `T` |

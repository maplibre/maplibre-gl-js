# Complete\<T\>

> **Complete**\<`T`\> = { \[P in keyof Required\<T\>\]: Pick\<T, P\> extends Required\<Pick\<T, P\>\> ? T\[P\] : T\[P\] | undefined }

Defined in: [util/util.ts:1100](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/util.ts#L1100>)

Makes optional keys required and add the the undefined type.

```text
interface Test {
 foo: number;
 bar?: number;
 baz: number | undefined;
}

Complete<Test> {
 foo: number;
 bar: number | undefined;
 baz: number | undefined;
}
```

See https://medium.com/terria/typescript-transforming-optional-properties-to-required-properties-that-may-be-undefined-7482cb4e1585

## Type Parameters

| Type Parameter |
| --- |
| `T` |

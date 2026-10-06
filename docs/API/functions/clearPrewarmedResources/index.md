# clearPrewarmedResources()

> **clearPrewarmedResources**(): `void`

Defined in: [util/global\_worker\_pool.ts:52](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/global_worker_pool.ts#L52>)

Clears up resources that have previously been created by `prewarm()`. Note that this is typically not necessary. You should only call this function if you expect the user of your app to not return to a Map view at any point in your application.

## Returns

`void`

## Example

```ts
clearPrewarmedResources()
```

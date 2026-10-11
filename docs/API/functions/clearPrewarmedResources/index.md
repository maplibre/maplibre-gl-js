# clearPrewarmedResources()

> **clearPrewarmedResources**(): `void`

Defined in: [util/global\_worker\_pool.ts:52](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/util/global_worker_pool.ts#L52>)

Clears up resources that have previously been created by `prewarm()`. Note that this is typically not necessary. You should only call this function if you expect the user of your app to not return to a Map view at any point in your application.

## Returns

`void`

## Example

```ts
clearPrewarmedResources()
```

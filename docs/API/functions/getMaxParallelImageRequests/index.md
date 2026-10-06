# getMaxParallelImageRequests()

> **getMaxParallelImageRequests**(): `number`

Defined in: [index.ts:158](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/index.ts#L158>)

Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel, which affects performance in raster-heavy maps. 16 by default.

## Returns

`number`

Number of parallel requests currently configured.

## Example

```ts
getMaxParallelImageRequests();
```

# getMaxParallelImageRequests()

> **getMaxParallelImageRequests**(): `number`

Defined in: [index.ts:163](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/index.ts#L163>)

Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel, which affects performance in raster-heavy maps. 16 by default.

## Returns

`number`

Number of parallel requests currently configured.

## Example

```ts
getMaxParallelImageRequests();
```

# getMaxParallelImageRequests()

> **getMaxParallelImageRequests**(): `number`

Defined in: [index.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/index.ts#L162>)

Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel, which affects performance in raster-heavy maps. 16 by default.

## Returns

`number`

Number of parallel requests currently configured.

## Example

```ts
getMaxParallelImageRequests();
```

# getMaxParallelImageRequests()

> **getMaxParallelImageRequests**(): `number`

Defined in: [index.ts:158](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/index.ts#L158>)

Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel, which affects performance in raster-heavy maps. 16 by default.

## Returns

`number`

Number of parallel requests currently configured.

## Example

```ts
getMaxParallelImageRequests();
```

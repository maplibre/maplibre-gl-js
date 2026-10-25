# getMaxParallelImageRequests()

> **getMaxParallelImageRequests**(): `number`

Defined in: [index.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/index.ts#L162>)

Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel, which affects performance in raster-heavy maps. 16 by default.

## Returns

`number`

Number of parallel requests currently configured.

## Example

```ts
getMaxParallelImageRequests();
```

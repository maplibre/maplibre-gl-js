# setMaxParallelImageRequests()

> **setMaxParallelImageRequests**(`numRequests`: `number`): `void`

Defined in: [index.ts:168](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/index.ts#L168>)

Sets the maximum number of images (raster tiles, sprites, icons) to load in parallel, which affects performance in raster-heavy maps. 16 by default.

## Parameters

| Parameter | Type |
| --- | --- |
| `numRequests` | `number` |

## Returns

`void`

## Example

```ts
setMaxParallelImageRequests(10);
```

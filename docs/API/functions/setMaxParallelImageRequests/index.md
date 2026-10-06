# setMaxParallelImageRequests()

> **setMaxParallelImageRequests**(`numRequests`: `number`): `void`

Defined in: [index.ts:168](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/index.ts#L168>)

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

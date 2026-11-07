# setMaxParallelImageRequests()

> **setMaxParallelImageRequests**(`numRequests`: `number`): `void`

Defined in: [index.ts:172](<https://github.com/maplibre/maplibre-gl-js/blob/839df0849182abd7558a6727df16d8bdc4e4d15e/src/index.ts#L172>)

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

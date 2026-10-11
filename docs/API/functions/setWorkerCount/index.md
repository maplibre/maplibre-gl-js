# setWorkerCount()

> **setWorkerCount**(`count`: `number`): `void`

Defined in: [index.ts:147](<https://github.com/maplibre/maplibre-gl-js/blob/72927301b7594536630d896c45c64c4d0d4c587f/src/index.ts#L147>)

Sets the number of web workers instantiated on a page with GL JS maps. By default, workerCount is 1 except for Safari browser where it is set to half the number of CPU cores (capped at 3). Make sure to set this property before creating any map instances for it to have effect.

## Parameters

| Parameter | Type |
| --- | --- |
| `count` | `number` |

## Returns

`void`

## Example

```ts
setWorkerCount(2);
```

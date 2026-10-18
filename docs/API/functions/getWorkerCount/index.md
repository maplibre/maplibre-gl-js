# getWorkerCount()

> **getWorkerCount**(): `number`

Defined in: [index.ts:139](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/index.ts#L139>)

Gets the number of web workers instantiated on a page with GL JS maps. By default, workerCount is 1 except for Safari browser where it is set to half the number of CPU cores (capped at 3). Make sure to set this property before creating any map instances for it to have effect.

## Returns

`number`

Number of workers currently configured.

## Example

```ts
const workerCount = getWorkerCount()
```

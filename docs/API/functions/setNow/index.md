# setNow()

> **setNow**(`timestamp`: `number`): `void`

Defined in: [util/time\_control.ts:83](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/util/time_control.ts#L83>)

Freezes time at a specific timestamp for deterministic rendering. Useful for frame-by-frame video capture where each frame needs a consistent time value.

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `timestamp` | `number` | Time in milliseconds to freeze at |

## Returns

`void`

## Example

```ts
// Freeze time for video export at 60fps
setNow(0);           // First frame
// ... render frame ...
setNow(16.67);       // Second frame
// ... render frame ...
setNow(33.34);       // Third frame
// ... done ...
restoreNow();        // Resume normal time
```

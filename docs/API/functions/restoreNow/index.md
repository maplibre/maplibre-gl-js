# restoreNow()

> **restoreNow**(): `void`

Defined in: [util/time\_control.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/util/time_control.ts#L99>)

Restores normal time flow after freezing with setNow(). Call this after finishing deterministic rendering operations.

## Returns

`void`

## Example

```ts
// After video export, resume normal time
setNow(0);
// ... export frames ...
restoreNow(); // Map animations resume normally
```

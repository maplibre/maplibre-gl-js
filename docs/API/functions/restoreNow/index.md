# restoreNow()

> **restoreNow**(): `void`

Defined in: [util/time\_control.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/time_control.ts#L99>)

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

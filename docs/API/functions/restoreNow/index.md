# restoreNow()

> **restoreNow**(): `void`

Defined in: [util/time\_control.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/util/time_control.ts#L99>)

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

# restoreNow()

> **restoreNow**(): `void`

Defined in: [util/time\_control.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/861a52a6ba19017697d2532c602934cfd19f4de9/src/util/time_control.ts#L99>)

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

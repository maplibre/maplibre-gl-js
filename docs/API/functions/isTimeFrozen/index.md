# isTimeFrozen()

> **isTimeFrozen**(): `boolean`

Defined in: [util/time\_control.ts:114](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/time_control.ts#L114>)

Returns whether time is currently frozen.

## Returns

`boolean`

True if time is frozen via setNow(), false otherwise

## Example

```ts
setNow(1000);
console.log(isTimeFrozen()); // true
restoreNow();
console.log(isTimeFrozen()); // false
```

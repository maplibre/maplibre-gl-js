# isTimeFrozen()

> **isTimeFrozen**(): `boolean`

Defined in: [util/time\_control.ts:114](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/time_control.ts#L114>)

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

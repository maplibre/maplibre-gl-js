# DragPanOptions

> **DragPanOptions** = `object`

Defined in: [ui/handler/shim/drag\_pan.ts:7](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L7>)

A [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>) options object

## Properties

### deceleration?

> `optional` **deceleration?**: `number`

Defined in: [ui/handler/shim/drag\_pan.ts:23](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L23>)

the maximum value of the drag velocity.

#### Default Value

```ts
1400
```

---

### easing?

> `optional` **easing?**: (`t`: `number`) =\> `number`

Defined in: [ui/handler/shim/drag\_pan.ts:18](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L18>)

easing function applied to `map.panTo` when applying the drag.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `t` | `number` | the easing function |

#### Returns

`number`

#### Default Value

```ts
bezier(0, 0, 0.3, 1)
```

---

### linearity?

> `optional` **linearity?**: `number`

Defined in: [ui/handler/shim/drag\_pan.ts:12](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L12>)

factor used to scale the drag velocity

#### Default Value

```ts
0
```

---

### maxSpeed?

> `optional` **maxSpeed?**: `number`

Defined in: [ui/handler/shim/drag\_pan.ts:28](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/shim/drag_pan.ts#L28>)

the rate at which the speed reduces after the pan ends.

#### Default Value

```ts
2500
```

# EdgeInsets

Defined in: [geo/edge\_insets.ts:12](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L12>)

An `EdgeInset` object represents screen space padding applied to the edges of the viewport. This shifts the apparent center or the vanishing point of the map. This is useful for adding floating UI elements on top of the map and having the vanishing point shift as UI elements resize.

## Methods

### getCenter()

> **getCenter**(`width`: `number`, `height`: `number`): `Point`

Defined in: [geo/edge\_insets.ts:70](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L70>)

Utility method that computes the new apparent center or vanishing point after applying insets. This is in pixels and with the top left being (0.0) and +y being downwards.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `width` | `number` | the width |
| `height` | `number` | the height |

#### Returns

`Point`

the point

---

### interpolate()

> **interpolate**(`start`: `EdgeInsets` | [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>), `target`: [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>), `t`: `number`): `this`

Defined in: [geo/edge\_insets.ts:53](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L53>)

Interpolates the inset in-place. This maintains the current inset value for any inset not present in `target`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `start` | `EdgeInsets` \| [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>) | interpolation start |
| `target` | [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>) | interpolation target |
| `t` | `number` | interpolation step/weight |

#### Returns

`this`

the insets

---

### toJSON()

> **toJSON**(): [`Complete`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Complete/index.md>)\<[`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)\>

Defined in: [geo/edge\_insets.ts:95](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L95>)

Returns the current state as json, useful when you want to have a read-only representation of the inset.

#### Returns

[`Complete`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Complete/index.md>)\<[`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)\>

state as json

## Properties

### bottom

> **bottom**: `number`

Defined in: [geo/edge\_insets.ts:20](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L20>)

#### Default Value

```ts
0
```

---

### left

> **left**: `number`

Defined in: [geo/edge\_insets.ts:24](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L24>)

#### Default Value

```ts
0
```

---

### right

> **right**: `number`

Defined in: [geo/edge\_insets.ts:28](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L28>)

#### Default Value

```ts
0
```

---

### top

> **top**: `number`

Defined in: [geo/edge\_insets.ts:16](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/geo/edge_insets.ts#L16>)

#### Default Value

```ts
0
```

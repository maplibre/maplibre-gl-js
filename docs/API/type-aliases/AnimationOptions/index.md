# AnimationOptions

> **AnimationOptions** = `object`

Defined in: [ui/camera.ts:280](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/camera.ts#L280>)

Options common to map movement methods that involve animation, such as [Map.panBy](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#panby>) and [Map.easeTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#easeto>), controlling the duration and easing function of the animation. All properties are optional.

## Properties

### animate?

> `optional` **animate?**: `boolean`

Defined in: [ui/camera.ts:297](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/camera.ts#L297>)

If `false`, no animation will occur.

---

### duration?

> `optional` **duration?**: `number`

Defined in: [ui/camera.ts:284](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/camera.ts#L284>)

The animation's duration, measured in milliseconds.

---

### easing?

> `optional` **easing?**: (`_`: `number`) =\> `number`

Defined in: [ui/camera.ts:289](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/camera.ts#L289>)

A function taking a time in the range 0..1 and returning a number where 0 is the initial state and 1 is the final state.

#### Parameters

| Parameter | Type |
| --- | --- |
| `_` | `number` |

#### Returns

`number`

---

### essential?

> `optional` **essential?**: `boolean`

Defined in: [ui/camera.ts:302](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/camera.ts#L302>)

If `true`, then the animation is considered essential and will not be affected by [`prefers-reduced-motion`](<https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>).

---

### freezeElevation?

> `optional` **freezeElevation?**: `boolean`

Defined in: [ui/camera.ts:308](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/camera.ts#L308>)

Default false. Needed in 3D maps to let the camera stay in a constant height based on sea-level. After the animation finished the zoom-level will be recalculated in respect of the distance from the camera to the center-coordinate-altitude.

---

### offset?

> `optional` **offset?**: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)

Defined in: [ui/camera.ts:293](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/ui/camera.ts#L293>)

of the target center relative to real map container center at the end of animation.

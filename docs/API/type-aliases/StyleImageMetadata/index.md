# StyleImageMetadata

> **StyleImageMetadata** = `object`

Defined in: [style/style\_image.ts:58](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L58>)

The style's image metadata

## Properties

### content?

> `optional` **content?**: \[`number`, `number`, `number`, `number`\]

Defined in: [style/style\_image.ts:78](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L78>)

If `icon-text-fit` is used in a layer with this image, this option defines the part of the image that can be covered by the content in `text-field`.

---

### pixelRatio

> **pixelRatio**: `number`

Defined in: [style/style\_image.ts:62](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L62>)

The ratio of pixels in the image to physical pixels on the screen

---

### sdf

> **sdf**: `boolean`

Defined in: [style/style\_image.ts:66](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L66>)

Whether the image should be interpreted as an SDF image

---

### stretchX?

> `optional` **stretchX?**: \[`number`, `number`\]\[\]

Defined in: [style/style\_image.ts:70](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L70>)

If `icon-text-fit` is used in a layer with this image, this option defines the part(s) of the image that can be stretched horizontally.

---

### stretchY?

> `optional` **stretchY?**: \[`number`, `number`\]\[\]

Defined in: [style/style\_image.ts:74](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L74>)

If `icon-text-fit` is used in a layer with this image, this option defines the part(s) of the image that can be stretched vertically.

---

### textFitHeight?

> `optional` **textFitHeight?**: [`TextFit`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/TextFit/index.md>)

Defined in: [style/style\_image.ts:86](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L86>)

If `icon-text-fit` is used in a layer with this image, this option defines constraints on the vertical scaling of the image.

---

### textFitWidth?

> `optional` **textFitWidth?**: [`TextFit`](<https://maplibre.org/maplibre-gl-js/docs/API/enumerations/TextFit/index.md>)

Defined in: [style/style\_image.ts:82](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L82>)

If `icon-text-fit` is used in a layer with this image, this option defines constraints on the horizontal scaling of the image.

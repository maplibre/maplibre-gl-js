# TextFit

Defined in: [style/style\_image.ts:37](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L37>)

Enumeration of possible values for StyleImageMetadata.textFitWidth and textFitHeight.

## Enumeration Members

### proportional

> **proportional**: `"proportional"`

Defined in: [style/style\_image.ts:52](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L52>)

The image will be resized on the specified axis to fit the content rectangle to the target text and will resize the other axis to maintain the aspect ratio of the content rectangle.

---

### stretchOnly

> **stretchOnly**: `"stretchOnly"`

Defined in: [style/style\_image.ts:47](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L47>)

The image will be resized on the specified axis to fit the content rectangle to the target text, but will not fall below the aspect ratio of the original content rectangle if the other axis is set to proportional.

---

### stretchOrShrink

> **stretchOrShrink**: `"stretchOrShrink"`

Defined in: [style/style\_image.ts:42](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L42>)

The image will be resized on the specified axis to tightly fit the content rectangle to target text. This is the same as not being defined.

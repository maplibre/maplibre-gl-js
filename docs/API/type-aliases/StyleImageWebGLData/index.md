# StyleImageWebGLData

> **StyleImageWebGLData** = `object`

Defined in: [style/style\_image.ts:116](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_image.ts#L116>)

What a [StyleImageInterface](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/StyleImageInterface/index.md>) gives as its `data` when it renders itself with WebGL rather than handing over an array of pixels.

## See

[Animate an icon on the GPU.](<https://maplibre.org/maplibre-gl-js/docs/examples/animate-an-icon-on-the-gpu/>)

## Properties

### renderWithWebGL

> **renderWithWebGL**: (`target`: [`StyleImageWebGLTarget`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageWebGLTarget/index.md>)) =\> `void`

Defined in: [style/style\_image.ts:134](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_image.ts#L134>)

Render exactly `width` x `height` premultiplied-alpha pixels at (`x`, `y`) of `target.texture`. That rectangle is the only part of the shared atlas that belongs to this image; drawing outside it corrupts the others.

This is the image's counterpart to [CustomLayerInterface.render](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/#render>), and the context arrives in the same state a custom layer's is given: cull face, active texture and the pixel store settings at their WebGL defaults, and no vertex array bound. Everything is yours to change, and MapLibre restores its own state afterwards. The scissor test is the one exception: MapLibre leaves it disabled rather than restoring it, so an image that enables it has to disable it again.

Called before the first frame the image is used in, again whenever [StyleImageInterface.render](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/StyleImageInterface/#render>) returns `true`, and again for each atlas holding a slot this image has never rendered into, so one change may mean several calls with different targets.

#### Parameters

| Parameter | Type |
| --- | --- |
| `target` | [`StyleImageWebGLTarget`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageWebGLTarget/index.md>) |

#### Returns

`void`

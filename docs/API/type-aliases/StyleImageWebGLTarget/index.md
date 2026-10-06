# StyleImageWebGLTarget

> **StyleImageWebGLTarget** = `object`

Defined in: [style/style\_image.ts:97](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_image.ts#L97>)

Where a [StyleImageWebGLData.renderWithWebGL](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageWebGLData/#renderwithwebgl>) callback writes its pixels.

## Properties

### texture

> **texture**: `WebGLTexture`

Defined in: [style/style\_image.ts:103](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/style/style_image.ts#L103>)

The icon atlas to write into. MapLibre does not bind it for you, so start with `gl.bindTexture(gl.TEXTURE_2D, texture)` or attach it to your own framebuffer.

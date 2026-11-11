# GPUInitializationError

Defined in: [util/gpu\_initialization\_error.ts:10](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/util/gpu_initialization_error.ts#L10>)

Thrown by the `Map` constructor when a GPU rendering context cannot be created, or fired via the map's `error` event when recreating the context after a `webglcontextrestored` fails.

Carries the canvas attributes that were requested and, when the browser provided one, the originating `webglcontextcreationerror` `statusMessage`. Consumers can branch on `instanceof GPUInitializationError` and inspect the cause programmatically.

## See

https://wiki.openstreetmap.org/wiki/This\_map\_requires\_WebGL

## Extends

- `Error`

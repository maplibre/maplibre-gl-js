# MapOptions

> **MapOptions** = `object`

Defined in: [ui/map.ts:84](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L84>)

The [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) options object.

## Properties

### anisotropicFilterPitch?

> `optional` **anisotropicFilterPitch?**: `number` | `null`

Defined in: [ui/map.ts:180](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L180>)

The pitch above which to apply anisotropic filtering to the map's raster layers (0-180).

#### Default Value

```ts
20
```

---

### aroundCenter?

> `optional` **aroundCenter?**: `boolean`

Defined in: [ui/map.ts:444](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L444>)

Determines the rotation interaction model: - When true: Uses "Orbital" logic where rotation is relative to the pivot center. Dragging right at the top rotates clockwise, while dragging right at the bottom rotates counter-clockwise (like spinning a physical globe). - When false: Uses "Linear" logic where horizontal mouse movement translates directly to bearing change regardless of cursor position.

---

### attributionControl?

> `optional` **attributionControl?**: `false` | [`AttributionControlOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AttributionControlOptions/index.md>)

Defined in: [ui/map.ts:125](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L125>)

If set, an [AttributionControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/AttributionControl/index.md>) will be added to the map with the provided options. To disable the attribution control, pass `false`.

> [!NOTE]
>
> Showing the logo of MapLibre is not required for using MapLibre.

#### Default Value

```ts
compact: true, customAttribution: "MapLibre ...".
```

---

### bearing?

> `optional` **bearing?**: `number`

Defined in: [ui/map.ts:249](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L249>)

The initial bearing (rotation) of the map, measured in degrees counter-clockwise from north. If `bearing` is not specified in the constructor options, MapLibre GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.

#### Default Value

```ts
0
```

---

### bearingSnap?

> `optional` **bearingSnap?**: `number`

Defined in: [ui/map.ts:110](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L110>)

The threshold, measured in degrees, that determines when the map's bearing will snap to north. For example, with a `bearingSnap` of 7, if the user rotates the map within 7 degrees of north, the map will automatically snap to exact north.

#### Default Value

```ts
7
```

---

### bounds?

> `optional` **bounds?**: [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>)

Defined in: [ui/map.ts:329](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L329>)

The initial bounds of the map. If `bounds` is specified, it overrides `center` and `zoom` constructor options.

---

### boxZoom?

> `optional` **boxZoom?**: `boolean` | [`BoxZoomHandlerOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/BoxZoomHandlerOptions/index.md>)

Defined in: [ui/map.ts:187](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L187>)

If `true`, the "box zoom" interaction is enabled (see [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>)). An `Object` value configures [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>) options. If `boxZoomEnd` is provided, the callback runs instead of the default fit-to-box zoom.

#### Default Value

```ts
true
```

---

### cancelPendingTileRequestsWhileZooming?

> `optional` **cancelPendingTileRequestsWhileZooming?**: `boolean`

Defined in: [ui/map.ts:402](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L402>)

Determines whether to cancel, or retain, tiles from the current viewport which are still loading but which belong to a farther (smaller) zoom level than the current one. \* If `true`, when zooming in, tiles which didn't manage to load for previous zoom levels will become canceled. This might save some computing resources for slower devices, but the map details might appear more abruptly at the end of the zoom. \* If `false`, when zooming in, the previous zoom level(s) tiles will progressively appear, giving a smoother map details experience. However, more tiles will be rendered in a short period of time.

#### Default Value

```ts
true
```

---

### canvasContextAttributes?

> `optional` **canvasContextAttributes?**: `WebGLContextAttributesWithType`

Defined in: [ui/map.ts:141](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L141>)

Set of WebGLContextAttributes that are applied to the WebGL context of the map. See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext for more details. `contextType` is restricted to `'webgl2'`. This option is kept as a forward-looking API for future WebGPU support.

#### Default Value

```ts
antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false, desynchronized: false, contextType: 'webgl2'
```

---

### center?

> `optional` **center?**: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)

Defined in: [ui/map.ts:234](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L234>)

The initial geographical centerpoint of the map. If `center` is not specified in the constructor options, MapLibre GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `[0, 0]`

> [!NOTE]
>
> MapLibre GL JS uses longitude, latitude coordinate order (as opposed to latitude, longitude) to match GeoJSON.

#### Default Value

```ts
[0, 0]
```

---

### centerClampedToGround?

> `optional` **centerClampedToGround?**: `boolean`

Defined in: [ui/map.ts:409](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L409>)

If true, the elevation of the center point will automatically be set to the terrain elevation (or zero if terrain is not enabled). If false, the elevation of the center point will default to sea level and will not automatically update. Defaults to true. Needs to be set to false to keep the camera above ground when pitch \> 90 degrees.

---

### clickTolerance?

> `optional` **clickTolerance?**: `number`

Defined in: [ui/map.ts:325](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L325>)

The max number of pixels a user can shift the mouse pointer during a click for it to be considered a valid click (as opposed to a mouse drag).

#### Default Value

```ts
3
```

---

### collectResourceTiming?

> `optional` **collectResourceTiming?**: `boolean`

Defined in: [ui/map.ts:320](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L320>)

If `true`, Resource Timing API information will be collected for requests made by GeoJSON and Vector Tile web workers (this information is normally inaccessible from the main Javascript thread). Information will be returned in a `resourceTiming` property of relevant `data` events.

#### Default Value

```ts
false
```

---

### container

> **container**: `HTMLElement` | `string`

Defined in: [ui/map.ts:103](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L103>)

The HTML element in which MapLibre GL JS will render the map, or the element's string `id`. The specified element must have no children.

---

### cooperativeGestures?

> `optional` **cooperativeGestures?**: [`GestureOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GestureOptions/index.md>)

Defined in: [ui/map.ts:222](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L222>)

If `true` or set to an options object, the map is only accessible on desktop while holding Command/Ctrl and only accessible on mobile with two fingers. Interacting with the map using normal gestures will trigger an informational screen. With this option enabled, "drag to pitch" requires a three-finger gesture. Cooperative gestures are disabled when a map enters fullscreen using [FullscreenControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenControl/index.md>).

#### Default Value

```ts
false
```

---

### crossSourceCollisions?

> `optional` **crossSourceCollisions?**: `boolean`

Defined in: [ui/map.ts:315](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L315>)

If `true`, symbols from multiple sources can collide with each other during collision detection. If `false`, collision detection is run separately for the symbols in each source.

#### Default Value

```ts
true
```

---

### doubleClickZoom?

> `optional` **doubleClickZoom?**: `boolean`

Defined in: [ui/map.ts:207](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L207>)

If `true`, the "double click to zoom" interaction is enabled (see [DoubleClickZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DoubleClickZoomHandler/index.md>)).

#### Default Value

```ts
true
```

---

### dragPan?

> `optional` **dragPan?**: `boolean` | [`DragPanOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/DragPanOptions/index.md>)

Defined in: [ui/map.ts:197](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L197>)

If `true`, the "drag to pan" interaction is enabled. An `Object` value is passed as options to [DragPanHandler.enable](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/#enable>).

#### Default Value

```ts
true
```

---

### dragRotate?

> `optional` **dragRotate?**: `boolean`

Defined in: [ui/map.ts:192](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L192>)

If `true`, the "drag to rotate" interaction is enabled (see [DragRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>)).

#### Default Value

```ts
true
```

---

### elevation?

> `optional` **elevation?**: `number`

Defined in: [ui/map.ts:239](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L239>)

The elevation of the initial geographical centerpoint of the map, in meters above sea level. If `elevation` is not specified in the constructor options, it will default to `0`.

#### Default Value

```ts
0
```

---

### fadeDuration?

> `optional` **fadeDuration?**: `number`

Defined in: [ui/map.ts:310](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L310>)

Controls the duration of the fade-in/fade-out animation for label collisions after initial map load, in milliseconds. This setting affects all symbol layers. This setting does not affect the duration of runtime styling transitions or raster tile cross-fading.

#### Default Value

```ts
300
```

---

### fitBoundsOptions?

> `optional` **fitBoundsOptions?**: [`FitBoundsOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/index.md>)

Defined in: [ui/map.ts:333](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L333>)

A [FitBoundsOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/index.md>) options object to use *only* when fitting the initial `bounds` provided above.

---

### hash?

> `optional` **hash?**: `boolean` | `string`

Defined in: [ui/map.ts:94](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L94>)

If `true`, the map's position (zoom, center latitude, center longitude, bearing, and pitch) will be synced with the hash fragment of the page's URL. For example, `https://example.com#2.59/39.26/53.07/-24.1/60`.

An additional string may optionally be provided as an alternative to indicate a parameter-styled hash. For example, passing `hash: "foo"` will produce a hash like `https://example.com#foo=2.59/39.26/53.07/-24.1/60`. This is usefull for allowing multiple maps or other state.

#### Default Value

```ts
false
```

---

### interactive?

> `optional` **interactive?**: `boolean`

Defined in: [ui/map.ts:99](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L99>)

If `false`, no mouse, touch, or keyboard listeners will be attached to the map, so it will not respond to interaction.

#### Default Value

```ts
true
```

---

### keyboard?

> `optional` **keyboard?**: `boolean`

Defined in: [ui/map.ts:202](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L202>)

If `true`, keyboard shortcuts are enabled (see [KeyboardHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/KeyboardHandler/index.md>)).

#### Default Value

```ts
true
```

---

### locale?

> `optional` **locale?**: `Record`\<`string`, `string`\>

Defined in: [ui/map.ts:305](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L305>)

A patch to apply to the default localization table for UI strings, e.g. control tooltips. The `locale` object maps namespaced UI string IDs to translated strings in the target language; see `src/ui/default_locale.js` for an example with all supported string IDs. The object may specify all UI strings (thereby adding support for a new translation) or only a subset of strings (thereby patching the default translation table). For an example, see https://maplibre.org/maplibre-gl-js/docs/examples/locale-switching/ Alternatively, search the official plugins page for plugins related to localization.

#### Default Value

```ts
null
```

---

### localIdeographFontFamily?

> `optional` **localIdeographFontFamily?**: `string` | `false`

Defined in: [ui/map.ts:343](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L343>)

Defines a CSS font-family for locally overriding generation of Chinese, Japanese, and Korean characters. For these characters, font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold). Set to `false`, to enable font settings from the map's style for these glyph ranges. The purpose of this option is to avoid bandwidth-intensive glyph server requests.

#### See

[Use locally generated ideographs](<https://maplibre.org/maplibre-gl-js/docs/examples/use-locally-generated-ideographs/>)

#### Default Value

```ts
'sans-serif'
```

---

### logoPosition?

> `optional` **logoPosition?**: [`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)

Defined in: [ui/map.ts:134](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L134>)

A string representing the position of the MapLibre wordmark on the map. Valid options are `top-left`,`top-right`, `bottom-left`, or `bottom-right`.

#### Default Value

```ts
'bottom-left'
```

---

### maplibreLogo?

> `optional` **maplibreLogo?**: `boolean`

Defined in: [ui/map.ts:129](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L129>)

If `true`, the MapLibre logo will be shown.

---

### maxBounds?

> `optional` **maxBounds?**: [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>)

Defined in: [ui/map.ts:150](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L150>)

If set, the map will be constrained to the given bounds.

---

### maxCanvasSize?

> `optional` **maxCanvasSize?**: \[`number`, `number`\]

Defined in: [ui/map.ts:395](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L395>)

The canvas' `width` and `height` max size. The values are passed as an array where the first element is max width and the second element is max height. You shouldn't set this above WebGl `MAX_TEXTURE_SIZE`. A larger canvas is not refused: the pixel ratio is lowered to fit and a warning is logged once.

#### Default Value

```ts
[4096, 4096].
```

---

### maxPitch?

> `optional` **maxPitch?**: `number` | `null`

Defined in: [ui/map.ts:175](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L175>)

The maximum pitch of the map (0-180).

#### Default Value

```ts
60
```

---

### maxTileCacheSize?

> `optional` **maxTileCacheSize?**: `number` | `null`

Defined in: [ui/map.ts:274](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L274>)

The maximum number of tiles stored in the tile cache for a given source. If omitted, the cache will be dynamically sized based on the current viewport which can be set using `maxTileCacheZoomLevels` constructor options.

#### Default Value

```ts
null
```

---

### maxTileCacheZoomLevels?

> `optional` **maxTileCacheZoomLevels?**: `number`

Defined in: [ui/map.ts:279](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L279>)

The maximum number of zoom levels for which to store tiles for a given source. Tile cache dynamic size is calculated by multiplying `maxTileCacheZoomLevels` with the approximate number of tiles in the viewport for a given source.

#### Default Value

```ts
5
```

---

### maxZoom?

> `optional` **maxZoom?**: `number` | `null`

Defined in: [ui/map.ts:165](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L165>)

The maximum zoom level of the map. Users cannot zoom in beyond this level. (0–24)

#### Default Value

```ts
22
```

---

### minPitch?

> `optional` **minPitch?**: `number` | `null`

Defined in: [ui/map.ts:170](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L170>)

The minimum pitch of the map (0-180).

#### Default Value

```ts
0
```

---

### minZoom?

> `optional` **minZoom?**: `number` | `null`

Defined in: [ui/map.ts:160](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L160>)

The minimum zoom level of the map. Users cannot zoom out beyond this level. (0–24)

#### Default Value

```ts
0
```

---

### pitch?

> `optional` **pitch?**: `number`

Defined in: [ui/map.ts:254](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L254>)

The initial pitch (tilt) of the map, measured in degrees away from the plane of the screen (0-85). If `pitch` is not specified in the constructor options, MapLibre GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`. Values greater than 60 degrees are experimental and may result in rendering issues. If you encounter any, please raise an issue with details in the MapLibre project.

#### Default Value

```ts
0
```

---

### pitchSpeed?

> `optional` **pitchSpeed?**: `number`

Defined in: [ui/map.ts:371](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L371>)

Degrees the map's pitch changes per pixel of vertical drag. Negative, so that dragging up pitches the map toward the horizon.

#### Default Value

```ts
-0.5
```

---

### pitchWithRotate?

> `optional` **pitchWithRotate?**: `boolean`

Defined in: [ui/map.ts:355](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L355>)

If `false`, the map's pitch (tilt) control with "drag to rotate" interaction will be disabled.

#### Default Value

```ts
true
```

---

### pixelRatio?

> `optional` **pixelRatio?**: `number`

Defined in: [ui/map.ts:381](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L381>)

The pixel ratio. The canvas' `width` attribute will be `container.clientWidth * pixelRatio` and its `height` attribute will be `container.clientHeight * pixelRatio`. Defaults to `devicePixelRatio` if not specified.

---

### reduceMotion?

> `optional` **reduceMotion?**: `boolean`

Defined in: [ui/map.ts:376](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L376>)

If `true`, gesture inertia (such as panning) is disabled. If not provided, gesture inertia defaults to the user's device settings.

#### Default Value

```ts
undefined
```

---

### refreshExpiredTiles?

> `optional` **refreshExpiredTiles?**: `boolean`

Defined in: [ui/map.ts:146](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L146>)

If `false`, the map won't attempt to re-request tiles once they expire per their HTTP `cacheControl`/`expires` headers.

#### Default Value

```ts
true
```

---

### renderWorldCopies?

> `optional` **renderWorldCopies?**: `boolean`

Defined in: [ui/map.ts:269](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L269>)

If `true`, multiple copies of the world will be rendered side by side beyond -180 and 180 degrees longitude. If set to `false`:

- When the map is zoomed out far enough that a single representation of the world does not fill the map's entire container, there will be blank space beyond 180 and -180 degrees longitude.
- Features that cross 180 and -180 degrees longitude will be cut in two (with one portion on the right edge of the map and the other on the left edge of the map) at every zoom level.

#### Default Value

```ts
true
```

---

### roll?

> `optional` **roll?**: `number`

Defined in: [ui/map.ts:259](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L259>)

The initial roll angle of the map, measured in degrees counter-clockwise about the camera boresight. If `roll` is not specified in the constructor options, MapLibre GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.

#### Default Value

```ts
0
```

---

### rollEnabled?

> `optional` **rollEnabled?**: `boolean`

Defined in: [ui/map.ts:360](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L360>)

If `false`, the map's roll control with "drag to rotate" interaction will be disabled.

#### Default Value

```ts
false
```

---

### rotateSpeed?

> `optional` **rotateSpeed?**: `number`

Defined in: [ui/map.ts:365](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L365>)

Degrees the map's bearing changes per pixel of horizontal drag when rotating.

#### Default Value

```ts
0.8
```

---

### scrollZoom?

> `optional` **scrollZoom?**: `boolean` | [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>)

Defined in: [ui/map.ts:155](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L155>)

If `true`, the "scroll to zoom" interaction is enabled. [AroundCenterOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>) are passed as options to [ScrollZoomHandler.enable](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/#enable>).

#### Default Value

```ts
true
```

---

### style?

> `optional` **style?**: `StyleSpecification` | `string`

Defined in: [ui/map.ts:350](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L350>)

The map's MapLibre style. This must be a JSON object conforming to the schema described in the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/>), or a URL to such JSON. When the style is not specified, calling [Map.setStyle](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setstyle>) is required to render the map.

---

### terrainSkirtLength?

> `optional` **terrainSkirtLength?**: `"none"` | `"auto"`

Defined in: [ui/map.ts:422](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L422>)

Controls the length of the vertical extensions which are added to the edges of terrain tiles.

If the skirts are introducing visually unappealing vertical artifacts, consider avoiding transparent or semi-transparent backgrounds, for example, by having the first layer be a background layer with a [`background-color`](<https://maplibre.org/maplibre-style-spec/layers/#background-color>). If that is impossible or insufficient, you can entirely disable skirts, at the cost of potentially introducing some horizontal hairline gaps (stitches) on tile boundaries with different zoomlevels for some terrain datasets.

- `"none"` disables skirts entirely.
- `"auto"` renders skirts with an automatically chosen length.

#### Default Value

```ts
"auto"
```

---

### touchPitch?

> `optional` **touchPitch?**: `boolean` | [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>)

Defined in: [ui/map.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L217>)

If `true`, the "drag to pitch" interaction is enabled. An `Object` value is passed as options to [TwoFingersTouchPitchHandler.enable](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchPitchHandler/#enable>).

#### Default Value

```ts
true
```

---

### touchZoomRotate?

> `optional` **touchZoomRotate?**: `boolean` | [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>)

Defined in: [ui/map.ts:212](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L212>)

If `true`, the "pinch to rotate and zoom" interaction is enabled. An `Object` value is passed as options to [TwoFingersTouchZoomRotateHandler.enable](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/#enable>).

#### Default Value

```ts
true
```

---

### trackResize?

> `optional` **trackResize?**: `boolean`

Defined in: [ui/map.ts:227](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L227>)

If `true`, the map will automatically resize when the browser window resizes.

#### Default Value

```ts
true
```

---

### transformCameraUpdate?

> `optional` **transformCameraUpdate?**: [`CameraUpdateTransformFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraUpdateTransformFunction/index.md>) | `null`

Defined in: [ui/map.ts:291](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L291>)

A callback run before the map's camera is moved due to user input or animation. The callback can be used to modify the new center, zoom, pitch and bearing. Expected to return an object containing center, zoom, pitch or bearing values to overwrite.

#### Default Value

```ts
null
```

---

### transformConstrain?

> `optional` **transformConstrain?**: [`TransformConstrainFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformConstrainFunction/index.md>) | `null`

Defined in: [ui/map.ts:298](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L298>)

A callback that overrides how the map constrains the viewport's lnglat and zoom to respect the longitude and latitude bounds.

#### See

[Customize the map transform constrain](<https://maplibre.org/maplibre-gl-js/docs/examples/customize-the-map-transform-constrain/>) Expected to return an object containing center and zoom.

#### Default Value

```ts
null
```

---

### transformRequest?

> `optional` **transformRequest?**: [`RequestTransformFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestTransformFunction/index.md>) | `null`

Defined in: [ui/map.ts:285](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L285>)

A callback run before the Map makes a request for an external URL. The callback can be used to modify the url, set headers, or set the credentials property for cross-origin requests. Expected to return an object with a `url` property and optionally `headers` and `credentials` properties.

#### Default Value

```ts
null
```

---

### validateStyle?

> `optional` **validateStyle?**: `boolean`

Defined in: [ui/map.ts:388](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L388>)

If false, style validation will be skipped. Useful in production environments due to enabling tree-shaking of the validation code in some environments and minor performance improvements. Disabling this option comes at the cost of less clear error messages

#### Default Value

```ts
true
```

---

### zoom?

> `optional` **zoom?**: `number`

Defined in: [ui/map.ts:244](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L244>)

The initial zoom level of the map. If `zoom` is not specified in the constructor options, MapLibre GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.

#### Default Value

```ts
0
```

---

### zoomLevelsToOverscale?

> `optional` **zoomLevelsToOverscale?**: `number`

Defined in: [ui/map.ts:435](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L435>)

Defines the number of zoom level that will overscale instead of split tiles below (inclusive) a map's `maxZoom`. When `undefined`, all zoom levels after source's max zoom will be overscaled.

This can help in reducing the size of the overscaling and improve performance in high zoom levels. The drawback is that it changes rendering for polygon centered labels and changes the results of query rendered features.

For example if map's `maxZoom` is 20, the source's `maxzoom` is 10 (tiles are avaliable until zoom 10) and `zoomLevelsToOverscale` is set to 3: - The zoom levels of 20, 19, 18 will be overscaled. - The zoom levels 11 to 17 will be split.

#### Default Value

```ts
4
```

---

### zoomSnap?

> `optional` **zoomSnap?**: `number`

Defined in: [ui/map.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L117>)

The step increment the zoom level will snap to. For example, if `zoomSnap` is 1, the map will snap to whole integers during discrete zoom operations. If set to 0, zooming is continuous.

#### Default Value

```ts
0
```

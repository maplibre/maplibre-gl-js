# FlyToOptions

> **FlyToOptions** = [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) &amp; [`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>) &amp; `object`

Defined in: [ui/camera.ts:158](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/camera.ts#L158>)

The [Map.flyTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#flyto>) options object

## Type Declaration

### curve?

> `optional` **curve?**: `number`

The zooming "curve" that will occur along the flight path. A high value maximizes zooming for an exaggerated animation, while a low value minimizes zooming for an effect closer to [Map.easeTo](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#easeto>). 1.42 is the average value selected by participants in the user study discussed in [van Wijk (2003)](<https://www.win.tue.nl/~vanwijk/zoompan.pdf>). A value of `Math.pow(6, 0.25)` would be equivalent to the root mean squared average velocity. A value of 1 would produce a circular motion.

#### Default Value

```ts
1.42
```

### maxDuration?

> `optional` **maxDuration?**: `number`

The animation's maximum duration, measured in milliseconds. If duration exceeds maximum duration, it resets to 0.

### minZoom?

> `optional` **minZoom?**: `number`

The minimum zoom level that the flight arc may reach. The animation will not zoom out beyond this level. If the natural flight arc stays within this boundary, the arc is unchanged. This acts as a ceiling on zoom-out even when `options.curve` is also specified.

### padding?

> `optional` **padding?**: `number` | [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)

The amount of padding in pixels to add to the given bounds.

### screenSpeed?

> `optional` **screenSpeed?**: `number`

The average speed of the animation measured in screenfulls per second, assuming a linear timing curve. If `options.speed` is specified, this option is ignored.

### speed?

> `optional` **speed?**: `number`

The average speed of the animation defined in relation to `options.curve`. A speed of 1.2 means that the map appears to move along the flight path by 1.2 times `options.curve` screenfulls every second. A *screenfull* is the map's visible span. It does not correspond to a fixed physical distance, but varies by zoom level.

#### Default Value

```ts
1.2
```

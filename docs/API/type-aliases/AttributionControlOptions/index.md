# AttributionControlOptions

> **AttributionControlOptions** = `object`

Defined in: [ui/control/attribution\_control.ts:10](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/attribution_control.ts#L10>)

The [AttributionControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/AttributionControl/index.md>) options object

## Properties

### compact?

> `optional` **compact?**: `boolean`

Defined in: [ui/control/attribution\_control.ts:16](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/attribution_control.ts#L16>)

If `true`, the attribution control will always collapse when moving the map. If `false`, force the expanded attribution control. The default is a responsive attribution that collapses when the user moves the map on maps less than 640 pixels wide. **Attribution should not be collapsed if it can comfortably fit on the map. `compact` should only be used to modify default attribution when map size makes it impossible to fit default attribution and when the automatic compact resizing for default settings are not sufficient.**

---

### customAttribution?

> `optional` **customAttribution?**: `string` | `string`\[\]

Defined in: [ui/control/attribution\_control.ts:20](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/control/attribution_control.ts#L20>)

Attributions to show in addition to any other attributions.

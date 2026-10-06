# \~\~setRTLTextPlugin()\~\~

> **setRTLTextPlugin**(`pluginURL`: `string`, `lazy`: `boolean`): `Promise`\<`void`\>

Defined in: [index.ts:102](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/index.ts#L102>)

Sets the map's [RTL text plugin](<https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text>).

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `pluginURL` | `string` | URL pointing to the Mapbox RTL text plugin source. |
| `lazy` | `boolean` | If set to `true`, maplibre will defer loading the plugin until rtl text is encountered, rtl text will then be rendered only after the plugin finishes loading. |

## Returns

`Promise`\<`void`\>

## Deprecated

MapLibre shapes Arabic and reorders bidirectional text itself, so nothing has to be loaded for right-to-left languages to be drawn correctly. A plugin set here still replaces the built-in implementation, but this will be removed in a future release.

## Example

```ts
setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js', false);
```

## See

- [Add support for right-to-left scripts](<https://maplibre.org/maplibre-gl-js/docs/examples/add-support-for-right-to-left-scripts/>)
- [Display and style rich text labels](<https://maplibre.org/maplibre-gl-js/docs/examples/display-and-style-rich-text-labels/>)

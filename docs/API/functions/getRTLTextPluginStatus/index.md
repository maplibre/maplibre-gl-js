# \~\~getRTLTextPluginStatus()\~\~

> **getRTLTextPluginStatus**(): `string`

Defined in: [index.ts:121](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/index.ts#L121>)

Gets the map's [RTL text plugin](<https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text>) status. The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`. If the status is `loaded` and the plugin is requested again, an error will be thrown.

## Returns

`string`

## Deprecated

The status says nothing about whether right-to-left text can be drawn, which it always can be. It reports only on a plugin set through the deprecated [setRTLTextPlugin](<https://maplibre.org/maplibre-gl-js/docs/API/functions/setRTLTextPlugin/index.md>).

## Example

```ts
const pluginStatus = getRTLTextPluginStatus();
```

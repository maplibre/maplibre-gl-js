# \~\~getRTLTextPluginStatus()\~\~

> **getRTLTextPluginStatus**(): `string`

Defined in: [index.ts:120](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/index.ts#L120>)

Gets the map's [RTL text plugin](<https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text>) status. The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`. If the status is `loaded` and the plugin is requested again, an error will be thrown.

## Returns

`string`

## Deprecated

The status says nothing about whether right-to-left text can be drawn, which it always can be. It reports only on a plugin set through the deprecated [setRTLTextPlugin](<https://maplibre.org/maplibre-gl-js/docs/API/functions/setRTLTextPlugin/index.md>).

## Example

```ts
const pluginStatus = getRTLTextPluginStatus();
```

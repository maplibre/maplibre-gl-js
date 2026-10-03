# TransformStyleFunction

> **TransformStyleFunction** = (`previous`: `StyleSpecification` | `undefined`, `next`: `StyleSpecification`) =\> `StyleSpecification`

Defined in: [style/style.ts:177](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style.ts#L177>)

Part of [Map.setStyle](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setstyle>) options, transformStyle is a convenience function that allows to modify a style after it is fetched but before it is committed to the map state.

This function exposes previous and next styles, it can be commonly used to support a range of functionalities like:

- when previous style carries certain 'state' that needs to be carried over to a new style gracefully;
- when a desired style is a certain combination of previous and incoming style;
- when an incoming style requires modification based on external state.
- when an incoming style uses relative paths, which need to be converted to absolute.

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `previous` | `StyleSpecification` \| `undefined` | The current style. |
| `next` | `StyleSpecification` | The next style. |

## Returns

`StyleSpecification`

resulting style that will to be applied to the map

## Example

```ts
map.setStyle('https://demotiles.maplibre.org/style.json', {
  transformStyle: (previousStyle, nextStyle) => ({
      ...nextStyle,
      // make relative sprite path like "../sprite" absolute
      sprite: new URL(nextStyle.sprite, "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprites/").href,
      // make relative glyphs path like "../fonts/{fontstack}/{range}.pbf" absolute
      glyphs: new URL(nextStyle.glyphs, "https://demotiles.maplibre.org/font/").href,
      sources: {
          // make relative vector url like "../../" absolute
          ...nextStyle.sources.map(source => {
             if (source.url) {
                 source.url = new URL(source.url, "https://tiles.openfreemap.org/planet");
             }
             return source;
          }),
          // copy a source from previous style
          'osm': previousStyle.sources.osm
      },
      layers: [
          // background layer
          nextStyle.layers[0],
          // copy a layer from previous style
          previousStyle.layers[0],
          // other layers from the next style
          ...nextStyle.layers.slice(1).map(layer => {
              // hide the layers we don't need from demotiles style
              if (layer.id.startsWith('geolines')) {
                  layer.layout = {...layer.layout || {}, visibility: 'none'};
              // filter out US polygons
              } else if (layer.id.startsWith('coastline') || layer.id.startsWith('countries')) {
                  layer.filter = ['!=', ['get', 'ADM0_A3'], 'USA'];
              }
              return layer;
          })
      ]
  })
});
```

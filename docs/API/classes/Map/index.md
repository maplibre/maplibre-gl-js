# Map

Defined in: [ui/map.ts:592](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L592>)

The `Map` object represents the map on your page. It exposes methods and properties that enable you to programmatically change the map, and fires events as users interact with it.

You create a `Map` by specifying a `container` and other options, see [MapOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/index.md>) for the full list. Then MapLibre GL JS initializes the map on the page and returns your `Map` object.

## Example

```ts
let map = new Map({
  container: 'map',
  center: [-122.420679, 37.772537],
  zoom: 13,
  style: style_object,
  hash: true,
  transformRequest: (url, resourceType)=> {
    if(resourceType === 'Source' && url.startsWith('http://myHost')) {
      return {
       url: url.replace('http', 'https'),
       headers: { 'my-custom-header': true},
       credentials: 'include'  // Include cookies for cross-origin requests
     }
    }
  }
});
```

## See

[Display a map](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-map/>)

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>

## Accessors

### repaint

#### Get Signature

> **get** **repaint**(): `boolean`

Defined in: [ui/map.ts:4661](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4661>)

Gets and sets a Boolean indicating whether the map will continuously repaint. This information is useful for analyzing performance.

##### Returns

`boolean`

---

### showCollisionBoxes

#### Get Signature

> **get** **showCollisionBoxes**(): `boolean`

Defined in: [ui/map.ts:4629](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4629>)

Gets and sets a Boolean indicating whether the map will render boxes around all symbols in the data source, revealing which symbols were rendered or which were hidden due to collisions. This information is useful for debugging.

##### Returns

`boolean`

---

### showOverdrawInspector

#### Get Signature

> **get** **showOverdrawInspector**(): `boolean`

Defined in: [ui/map.ts:4650](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4650>)

Gets and sets a Boolean indicating whether the map should color-code each fragment to show how many times it has been shaded. White fragments have been shaded 8 or more times. Black fragments have been shaded 0 times. This information is useful for debugging.

##### Returns

`boolean`

---

### showPadding

#### Get Signature

> **get** **showPadding**(): `boolean`

Defined in: [ui/map.ts:4616](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4616>)

Gets and sets a Boolean indicating whether the map will visualize the padding offsets.

##### Returns

`boolean`

---

### showTileBoundaries

#### Get Signature

> **get** **showTileBoundaries**(): `boolean`

Defined in: [ui/map.ts:4605](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4605>)

Gets and sets a Boolean indicating whether the map will render an outline around each tile and the tile ID. These tile boundaries are useful for debugging.

The uncompressed file size of the first vector source is drawn in the top left corner of each tile, next to the tile ID.

##### Example

```ts
map.showTileBoundaries = true;
```

##### Returns

`boolean`

---

### version

#### Get Signature

> **get** **version**(): `string`

Defined in: [ui/map.ts:4676](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4676>)

Returns the package version of the library

##### Returns

`string`

Package version of the library

## Events

### off()

#### Call Signature

> **off**\<`T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\>(`type`: `T`, `layer`: `string`, `listener`: (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): `this`

Defined in: [ui/map.ts:2456](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2456>)

Removes an event listener for events previously added with `{@link Map.on}`.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type previously used to install the listener. |
| `layer` | `string` | The layer ID or listener previously used to install the listener. |
| `listener` | (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The function previously installed as a listener. |

##### Returns

`this`

##### Overrides

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

#### Call Signature

> **off**\<`T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\>(`type`: `T`, `layers`: `string`\[\], `listener`: (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): `this`

Defined in: [ui/map.ts:2469](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2469>)

Overload of the `off` method that allows to remove an event created with multiple layers. Provide the same layer IDs as to `on` or `once`, when the listener was registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |
| `layers` | `string`\[\] | The layer IDs previously used to install the listener. |
| `listener` | (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The function previously installed as a listener. |

##### Returns

`this`

##### Overrides

`Evented.off`

#### Call Signature

> **off**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`ev`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): `this`

Defined in: [ui/map.ts:2480](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2480>)

Overload of the `off` method that allows to remove an event created without specifying a layer.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |
| `listener` | (`ev`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The function previously installed as a listener. |

##### Returns

`this`

##### Overrides

`Evented.off`

#### Call Signature

> **off**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>), `listener`: [`Listener`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Listener/index.md>)): `this`

Defined in: [ui/map.ts:2487](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2487>)

Overload of the `off` method that allows to remove an event created without specifying a layer.

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) | The type of the event. |
| `listener` | [`Listener`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Listener/index.md>) | The function previously installed as a listener. |

##### Returns

`this`

##### Overrides

`Evented.off`

---

### on()

#### Call Signature

> **on**\<`T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\>(`type`: `T`, `layer`: `string`, `listener`: (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [ui/map.ts:2308](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2308>)

Adds a listener for events of a specified type, optionally limited to features in a specified style layer(s). See [MapEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) and [MapLayerEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) for a full list of events and their description.

| Event | Compatible with `layerId` |
| --- | --- |
| `mousedown` | yes |
| `mouseup` | yes |
| `mouseover` | yes |
| `mouseout` | yes |
| `mousemove` | yes |
| `mouseenter` | yes (required) |
| `mouseleave` | yes (required) |
| `click` | yes |
| `dblclick` | yes |
| `contextmenu` | yes |
| `touchstart` | yes |
| `touchend` | yes |
| `touchcancel` | yes |
| `wheel` |  |
| `resize` |  |
| `remove` |  |
| `touchmove` |  |
| `movestart` |  |
| `move` |  |
| `moveend` |  |
| `dragstart` |  |
| `drag` |  |
| `dragend` |  |
| `zoomstart` |  |
| `zoom` |  |
| `zoomend` |  |
| `rotatestart` |  |
| `rotate` |  |
| `rotateend` |  |
| `pitchstart` |  |
| `pitch` |  |
| `pitchend` |  |
| `boxzoomstart` |  |
| `boxzoomend` |  |
| `boxzoomcancel` |  |
| `webglcontextlost` |  |
| `webglcontextrestored` |  |
| `load` |  |
| `render` |  |
| `idle` |  |
| `error` |  |
| `data` |  |
| `styledata` |  |
| `sourcedata` |  |
| `dataloading` |  |
| `styledataloading` |  |
| `sourcedataloading` |  |
| `styleimagemissing` |  |
| `dataabort` |  |
| `sourcedataabort` |  |

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. Events compatible with the optional `layerId` parameter are triggered when the cursor enters a visible portion of the specified layer from outside that layer or outside the map canvas. |
| `layer` | `string` | The ID of a style layer or a listener if no ID is provided. Event will only be triggered if its location is within a visible feature in this layer. The event will have a `features` property containing an array of the matching features. If `layer` is not supplied, the event will not have a `features` property. Please note that many event types are not compatible with the optional `layer` parameter. |
| `listener` | (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The function to be called when the event is fired. |

##### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

##### Examples

```ts
// Set an event listener that will fire
// when the map has finished loading
map.on('load', () => {
  // Once the map has finished loading,
  // add a new layer
  map.addLayer({
    id: 'points-of-interest',
    source: {
      type: 'vector',
      url: 'https://maplibre.org/maplibre-style-spec/'
    },
    'source-layer': 'poi_label',
    type: 'circle',
    paint: {
      // MapLibre Style Specification paint properties
    },
    layout: {
      // MapLibre Style Specification layout properties
    }
  });
});
```

```ts
// Set an event listener that will fire
// when a feature on the countries layer of the map is clicked
map.on('click', 'countries', (e) => {
  new Popup()
    .setLngLat(e.lngLat)
    .setText(`Country name: ${e.features[0].properties.name}`)
    .addTo(map);
});
```

##### See

- [Display popup on click](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-click/>)
- [Center the map on a clicked symbol](<https://maplibre.org/maplibre-gl-js/docs/examples/center-the-map-on-a-clicked-symbol/>)
- [Create a hover effect](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/>)
- [Create a draggable marker](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

##### Overrides

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

#### Call Signature

> **on**\<`T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\>(`type`: `T`, `layerIds`: `string`\[\], `listener`: (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [ui/map.ts:2320](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2320>)

Overload of the `on` method that allows to listen to events specifying multiple layers.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |
| `layerIds` | `string`\[\] | The array of style layer IDs. |
| `listener` | (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The listener callback. |

##### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

##### Overrides

`Evented.on`

#### Call Signature

> **on**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`ev`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [ui/map.ts:2331](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2331>)

Overload of the `on` method that allows to listen to events without specifying a layer.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |
| `listener` | (`ev`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The listener callback. |

##### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

##### Overrides

`Evented.on`

#### Call Signature

> **on**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>), `listener`: [`Listener`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Listener/index.md>)): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [ui/map.ts:2338](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2338>)

Overload of the `on` method that allows to listen to events without specifying a layer.

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) | The type of the event. |
| `listener` | [`Listener`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Listener/index.md>) | The listener callback. |

##### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

##### Overrides

`Evented.on`

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\>(`type`: `T`, `layer`: `string`, `listener`: (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): `this`

Defined in: [ui/map.ts:2372](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2372>)

Adds a listener that will be called only once to a specified event type, optionally limited to features in a specified style layer.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for; one of `'mousedown'`, `'mouseup'`, `'click'`, `'dblclick'`, `'mousemove'`, `'mouseenter'`, `'mouseleave'`, `'mouseover'`, `'mouseout'`, `'contextmenu'`, `'touchstart'`, `'touchend'`, or `'touchcancel'`. `mouseenter` and `mouseover` events are triggered when the cursor enters a visible portion of the specified layer from outside that layer or outside the map canvas. `mouseleave` and `mouseout` events are triggered when the cursor leaves a visible portion of the specified layer, or leaves the map canvas. |
| `layer` | `string` | The ID of a style layer or a listener if no ID is provided. Only events whose location is within a visible feature in this layer will trigger the listener. The event will have a `features` property containing an array of the matching features. |
| `listener` | (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The function to be called when the event is fired. |

##### Returns

`this`

`this` if listener is provided, promise otherwise to allow easier usage of async/await

##### Overrides

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\>(`type`: `T`, `layer`: `string`): `Promise`\<[`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`\>

Defined in: [ui/map.ts:2384](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2384>)

Overload of the `once` method that, with a single layer and no listener, returns a promise resolving with the event for easier usage of async/await.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |
| `layer` | `string` | The ID of the style layer. |

##### Returns

`Promise`\<[`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`\>

##### Overrides

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\>(`type`: `T`, `layerIds`: `string`\[\], `listener`: (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): `this`

Defined in: [ui/map.ts:2395](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2395>)

Overload of the `once` method that allows to listen to events specifying multiple layers.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |
| `layerIds` | `string`\[\] | The array of style layer IDs. |
| `listener` | (`ev`: [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The listener callback. |

##### Returns

`this`

##### Overrides

`Evented.once`

#### Call Signature

> **once**\<`T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\>(`type`: `T`, `layerIds`: `string`\[\]): `Promise`\<[`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`\>

Defined in: [ui/map.ts:2407](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2407>)

Overload of the `once` method that, with multiple layers and no listener, returns a promise resolving with the event for easier usage of async/await.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |
| `layerIds` | `string`\[\] | The array of style layer IDs. |

##### Returns

`Promise`\<[`MapLayerEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)\[`T`\] &amp; `Object`\>

##### Overrides

`Evented.once`

#### Call Signature

> **once**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`, `listener`: (`ev`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void`): `this`

Defined in: [ui/map.ts:2417](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2417>)

Overload of the `once` method that allows to listen to events without specifying a layer.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |
| `listener` | (`ev`: [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\] &amp; `Object`) =\> `void` | The listener callback. |

##### Returns

`this`

##### Overrides

`Evented.once`

#### Call Signature

> **once**\<`T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\>(`type`: `T`): `Promise`\<[`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\] &amp; `Object`\>

Defined in: [ui/map.ts:2424](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2424>)

Overload of the `once` method that returns a promise resolving with the event, for easier usage of async/await, when no listener is provided.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The type of the event. |

##### Returns

`Promise`\<[`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)\[`T`\] &amp; `Object`\>

##### Overrides

`Evented.once`

#### Call Signature

> **once**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>), `listener?`: [`Listener`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Listener/index.md>)): `Promise`\<`any`\> | `Map`

Defined in: [ui/map.ts:2431](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2431>)

Overload of the `once` method that allows to listen to events without specifying a layer.

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) | The type of the event. |
| `listener?` | [`Listener`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/Listener/index.md>) | The listener callback. |

##### Returns

`Promise`\<`any`\> | `Map`

##### Overrides

`Evented.once`

## Methods

### \_shouldHandleInitialResize()

> **\_shouldHandleInitialResize**(): `boolean`

Defined in: [ui/map.ts:4077](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4077>)

Determines if the initial resize event should be handled based on the container's dimensions.

#### Returns

`boolean`

`true` if the initial resize event should be handled, `false` otherwise.

---

### addControl()

> **addControl**(`control`: [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>), `position?`: [`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>)): `this`

Defined in: [ui/map.ts:937](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L937>)

Adds an [IControl](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>) to the map, calling `control.onAdd(this)`.

An [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) will be fired if the control is invalid.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `control` | [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>) | The [IControl](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>) to add. |
| `position?` | [`ControlPosition`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/ControlPosition/index.md>) | position on the map to which the control will be added. Valid values are `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`. Defaults to `'top-right'`. |

#### Returns

`this`

#### Example

Add zoom and rotation controls to the map.

```ts
map.addControl(new NavigationControl());
```

#### See

[Display map navigation controls](<https://maplibre.org/maplibre-gl-js/docs/examples/display-map-navigation-controls/>)

---

### addImage()

> **addImage**(`id`: `string`, `image`: [`StyleImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageSource/index.md>), `options?`: `Partial`\<[`StyleImageMetadata`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageMetadata/index.md>)\>): `this`

Defined in: [ui/map.ts:3189](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3189>)

Add an image to the style. This image can be displayed on the map like any other icon in the style's sprite using the image's ID with [`icon-image`](<https://maplibre.org/maplibre-style-spec/layers/#layout-symbol-icon-image>), [`background-pattern`](<https://maplibre.org/maplibre-style-spec/layers/#paint-background-background-pattern>), [`fill-pattern`](<https://maplibre.org/maplibre-style-spec/layers/#paint-fill-fill-pattern>), or [`line-pattern`](<https://maplibre.org/maplibre-style-spec/layers/#paint-line-line-pattern>).

A [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) event will be fired if the image parameter is invalid or there is not enough space in the sprite to add this image.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the image. |
| `image` | [`StyleImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageSource/index.md>) | The image as an `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data` properties with the same format as `ImageData`. |
| `options` | `Partial`\<[`StyleImageMetadata`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageMetadata/index.md>)\> | Options object. |

#### Returns

`this`

#### Example

```ts
// If the style's sprite does not already contain an image with ID 'cat',
// add the image 'cat-icon.png' to the style's sprite with the ID 'cat'.
const image = await map.loadImage('https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Cat_silhouette.svg/400px-Cat_silhouette.svg.png');
if (!map.hasImage('cat')) map.addImage('cat', image.data);

// Add a stretchable image that can be used with `icon-text-fit`
// In this example, the image is 600px wide by 400px high.
const image = await map.loadImage('https://upload.wikimedia.org/wikipedia/commons/8/89/Black_and_White_Boxed_%28bordered%29.png');
if (map.hasImage('border-image')) return;
map.addImage('border-image', image.data, {
    content: [16, 16, 300, 384], // place text over left half of image, avoiding the 16px border
    stretchX: [[16, 584]], // stretch everything horizontally except the 16px border
    stretchY: [[16, 384]], // stretch everything vertically except the 16px border
});
```

#### See

- Use `HTMLImageElement`: [Add an icon to the map](<https://maplibre.org/maplibre-gl-js/docs/examples/add-an-icon-to-the-map/>)
- Use `ImageData`: [Add a generated icon to the map](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-generated-icon-to-the-map/>)

---

### addLayer()

> **addLayer**(`layer`: [`AddLayerObject`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddLayerObject/index.md>), `beforeId?`: `string`): `this`

Defined in: [ui/map.ts:3502](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3502>)

Adds a [MapLibre style layer](<https://maplibre.org/maplibre-style-spec/layers>) to the map's style.

A layer defines how data from a specified source will be styled. Read more about layer types and available paint and layout properties in the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/layers>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layer` | [`AddLayerObject`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AddLayerObject/index.md>) | The layer to add, conforming to either the MapLibre Style Specification's [layer definition](<https://maplibre.org/maplibre-style-spec/layers>) or, less commonly, the [CustomLayerInterface](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/index.md>) specification. Can also be a layer definition with an embedded source definition. The MapLibre Style Specification's layer definition is appropriate for most layers. |
| `beforeId?` | `string` | The ID of an existing layer to insert the new layer before, resulting in the new layer appearing visually beneath the existing layer. If this argument is not specified, the layer will be appended to the end of the layers array and appear visually above all other layers. |

#### Returns

`this`

#### Examples

Add a circle layer with a vector source

```ts
map.addLayer({
  id: 'points-of-interest',
  source: {
    type: 'vector',
    url: 'https://demotiles.maplibre.org/tiles/tiles.json'
  },
  'source-layer': 'poi_label',
  type: 'circle',
  paint: {
    // MapLibre Style Specification paint properties
  },
  layout: {
    // MapLibre Style Specification layout properties
  }
});
```

Define a source before using it to create a new layer

```ts
map.addSource('state-data', {
  type: 'geojson',
  data: 'path/to/data.geojson'
});

map.addLayer({
  id: 'states',
  // References the GeoJSON source defined above
  // and does not require a `source-layer`
  source: 'state-data',
  type: 'symbol',
  layout: {
    // Set the label content to the
    // feature's `name` property
    text-field: ['get', 'name']
  }
});
```

Add a new symbol layer before an existing layer

```ts
map.addLayer({
  id: 'states',
  // References a source that's already been defined
  source: 'state-data',
  type: 'symbol',
  layout: {
    // Set the label content to the
    // feature's `name` property
    text-field: ['get', 'name']
  }
// Add the layer before the existing `cities` layer
}, 'cities');
```

#### See

- [Create and style clusters](<https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/>)
- [Add a vector tile source](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-vector-tile-source/>)
- [Add a WMS source](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-wms-source/>)

---

### addSource()

> **addSource**(`id`: `string`, `source`: [`SourceSpecification`](<https://maplibre.org/maplibre-style-spec/sources/>) | [`CanvasSourceSpecification`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CanvasSourceSpecification/index.md>)): `this`

Defined in: [ui/map.ts:2912](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2912>)

Adds a source to the map's style.

Events triggered:

Triggers the `source.add` event.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the source to add. Must not conflict with existing sources. |
| `source` | [`SourceSpecification`](<https://maplibre.org/maplibre-style-spec/sources/>) \| [`CanvasSourceSpecification`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CanvasSourceSpecification/index.md>) | The source object, conforming to the MapLibre Style Specification's [source definition](<https://maplibre.org/maplibre-style-spec/sources>) or [CanvasSourceSpecification](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CanvasSourceSpecification/index.md>). |

#### Returns

`this`

#### Examples

```ts
map.addSource('my-data', {
  type: 'vector',
  url: 'https://demotiles.maplibre.org/tiles/tiles.json'
});
```

```ts
map.addSource('my-data', {
  "type": "geojson",
  "data": {
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": [-77.0396, 38.8891]
    },
    "properties": {
      "title": "Washington DC",
      "marker-symbol": "monument"
    }
  }
});
```

#### See

GeoJSON source: [Add live realtime data](<https://maplibre.org/maplibre-gl-js/docs/examples/add-live-realtime-data/>)

---

### addSprite()

> **addSprite**(`id`: `string`, `url`: `string`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:3784](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3784>)

Adds a sprite to the map's style. Fires the `style` event.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the sprite to add. Must not conflict with existing sprites. |
| `url` | `string` | The URL to load the sprite from |
| `options` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | Options object. |

#### Returns

`this`

#### Example

```ts
map.addSprite('sprite-two', 'http://example.com/sprite-two');
```

---

### areTilesLoaded()

> **areTilesLoaded**(): `boolean`

Defined in: [ui/map.ts:3047](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3047>)

Returns a Boolean indicating whether all tiles in the viewport from all sources on the style are loaded.

#### Returns

`boolean`

A Boolean indicating whether all tiles are loaded.

#### Example

```ts
let tilesLoaded = map.areTilesLoaded();
```

---

### calculateAnchoredCameraOptions()

> **calculateAnchoredCameraOptions**(`options`: [`AnchoredCameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnchoredCameraOptions/index.md>)): [`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>)

Defined in: [ui/map.ts:1437](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1437>)

Calculates constrained camera options that place a geographic anchor at a screen point without changing the map, using the same logic as MapLibre's interaction handlers.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`AnchoredCameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnchoredCameraOptions/index.md>) | Anchor and optional zoom. |

#### Returns

[`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>)

Camera options that can be passed to [Map.jumpTo](<#jumpto>).

#### Example

```ts
const cameraOptions = map.calculateAnchoredCameraOptions({
  anchorLocation: map.unproject(pointerDownPosition),
  anchorScreenPoint: currentPointerPosition,
  zoom: map.getZoom() + 1,
});
map.jumpTo(cameraOptions);
```

---

### calculateCameraOptionsFromCameraLngLatAltRotation()

> **calculateCameraOptionsFromCameraLngLatAltRotation**(`cameraLngLat`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>), `cameraAlt`: `number`, `bearing`: `number`, `pitch`: `number`, `roll?`: `number`): [`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>)

Defined in: [ui/map.ts:1461](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1461>)

Given a camera position and rotation, calculates zoom and center point and returns them as [CameraOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `cameraLngLat` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | The lng, lat of the camera to look from |
| `cameraAlt` | `number` | The altitude of the camera to look from, in meters above sea level |
| `bearing` | `number` | Bearing of the camera, in degrees |
| `pitch` | `number` | Pitch of the camera, in degrees |
| `roll?` | `number` | Roll of the camera, in degrees |

#### Returns

[`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>)

the calculated camera options

#### Example

```ts
// Calculate options to look from camera position(1°, 0°, 1000m) with bearing = 90°, pitch = 30°, and roll = 45°
const cameraLngLat = new LngLat(1, 0);
const cameraAltitude = 1000;
const bearing = 90;
const pitch = 30;
const roll = 45;
const cameraOptions = map.calculateCameraOptionsFromCameraLngLatAltRotation(cameraLngLat, cameraAltitude, bearing, pitch, roll);
// Apply calculated options
map.jumpTo(cameraOptions);
```

---

### calculateCameraOptionsFromTo()

> **calculateCameraOptionsFromTo**(`from`: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>), `altitudeFrom`: `number`, `to`: [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>), `altitudeTo?`: `number`): [`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>)

Defined in: [ui/map.ts:1566](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1566>)

Given a camera 'from' position and a position to look at (`to`), calculates zoom and camera rotation and returns them as [CameraOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>). Under `globe` and `vertical-perspective` the calculation follows the sphere while the map renders as a globe, keeping the point looked at on the sea-level sphere; `altitudeTo` only becomes the center elevation.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `from` | [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) | The camera to look from |
| `altitudeFrom` | `number` | The altitude of the camera to look from |
| `to` | [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) | The center to look at |
| `altitudeTo?` | `number` | Optional altitude of the center to look at. If none given the ground height will be used. |

#### Returns

[`CameraOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>)

the calculated camera options

#### Example

```ts
// Calculate options to look from (1°, 0°, 1000m) to (1°, 1°, 0m)
const cameraLngLat = new LngLat(1, 0);
const cameraAltitude = 1000;
const targetLngLat = new LngLat(1, 1);
const targetAltitude = 0;
const cameraOptions = map.calculateCameraOptionsFromTo(cameraLngLat, cameraAltitude, targetLngLat, targetAltitude);
// Apply calculated options
map.jumpTo(cameraOptions);
```

---

### cameraForBounds()

> **cameraForBounds**(`bounds`: [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>), `options?`: [`CameraForBoundsOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraForBoundsOptions/index.md>)): [`JumpToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/JumpToOptions/index.md>)

Defined in: [ui/map.ts:1350](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1350>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `bounds` | [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>) | Calculate the center for these bounds in the viewport and use the highest zoom level up to and including [Map.getMaxZoom](<#getmaxzoom>) that fits in the viewport. LngLatBounds represent a box that is always axis-aligned with bearing 0. Bounds will be taken in `[sw, ne]` order. Southwest point will always be to the left of the northeast point. |
| `options?` | [`CameraForBoundsOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraForBoundsOptions/index.md>) | Options object |

#### Returns

[`JumpToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/JumpToOptions/index.md>)

If map is able to fit to provided bounds, returns `center`, `zoom`, and `bearing`, plus `padding` when `absolutePadding` is set. If map is unable to fit, method will warn and return undefined.

#### Example

```ts
let bbox = [[-79, 43], [-73, 45]];
let newCameraTransform = map.cameraForBounds(bbox, {
  padding: {top: 10, bottom:25, left: 15, right: 5}
});
```

---

### coveringTiles()

> **coveringTiles**(`options`: `CoveringTilesOptions`): [`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>)\[\]

Defined in: [ui/map.ts:1019](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1019>)

Returns an array of `OverscaledTileID` objects that cover the current viewport for a given tile size. This method is useful for determining which tiles are visible in the current viewport.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | `CoveringTilesOptions` | Options for calculating the covering tiles. |

#### Returns

[`OverscaledTileID`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/OverscaledTileID/index.md>)\[\]

An array of `OverscaledTileID` objects.

#### Example

```ts
// Get the tiles to cover the view for a 512x512px tile source
const tiles = map.coveringTiles({tileSize: 512});
```

---

### easeTo()

> **easeTo**(`options`: [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1480](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1480>)

Changes any combination of `center`, `zoom`, `bearing`, `pitch`, `roll`, and `padding` with an animated transition between old and new values. The map will retain its current values for any details not specified in `options`.

> [!NOTE]
>
> **Reduced Motion**
>
> The transition will happen instantly if the user has enabled the `reduced motion` accessibility feature enabled in their operating system, unless `options` includes `essential: true`.

Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend`, `pitchstart`, `pitch`, `pitchend`, `rollstart`, `roll`, `rollend`, and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>) | Options describing the destination and animation of the transition. Accepts [CameraOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>) and [AnimationOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>). |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### See

[Navigate the map with game-like controls](<https://maplibre.org/maplibre-gl-js/docs/examples/navigate-the-map-with-game-like-controls/>)

---

### fire()

#### Call Signature

> **fire**(`event`: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) | [`MapStyleImageMissingEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>) | [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`unknown`\> | [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) | [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>) | [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>) | [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>) | [`MapStyleLoadEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>) | [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>) | [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>) | [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>) | [`MapWheelEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>) | [`MapTerrainEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>) | [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`TouchEvent` | `WheelEvent`\> &amp; `object` | [`MapProjectionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) \| [`MapStyleImageMissingEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>) \| [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`unknown`\> \| [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) \| [`MapMovementEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>) \| [`MapContextEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>) \| [`MapStyleDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>) \| [`MapStyleLoadEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>) \| [`MapBoxZoomEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>) \| [`MapTouchEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>) \| [`MapMouseEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>) \| [`MapWheelEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>) \| [`MapTerrainEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>) \| [`MapLibreEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)\<`TouchEvent` \| `WheelEvent`\> &amp; `object` \| [`MapProjectionEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>) |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

#### Call Signature

> **fire**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### fitBounds()

> **fitBounds**(`bounds`: [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>), `options?`: [`FitBoundsOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1371](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1371>)

Pans and zooms the map to contain its visible area within the specified geographical bounds. This function will also reset the map's bearing to 0 if bearing is nonzero.

Triggers the following events: `movestart` and `moveend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `bounds` | [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>) | Center these bounds in the viewport and use the highest zoom level up to and including [Map.getMaxZoom](<#getmaxzoom>) that fits them in the viewport. Bounds will be taken in `[sw, ne]` order. Southwest point will always be to the left of the northeast point. |
| `options?` | [`FitBoundsOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/index.md>) | Options supports all properties from [AnimationOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) and [CameraOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>) in addition to the fields below. |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

```ts
let bbox = [[-79, 43], [-73, 45]];
map.fitBounds(bbox, {
  padding: {top: 10, bottom:25, left: 15, right: 5}
});
```

#### See

[Fit a map to a bounding box](<https://maplibre.org/maplibre-gl-js/docs/examples/fit-a-map-to-a-bounding-box/>)

---

### fitScreenCoordinates()

> **fitScreenCoordinates**(`p0`: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>), `p1`: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>), `bearing`: `number`, `options?`: [`FitBoundsOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1394](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1394>)

Pans, rotates and zooms the map to to fit the box made by points p0 and p1 once the map is rotated to the specified bearing. To zoom without rotating, pass in the current map bearing.

Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend` and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `p0` | [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) | First point on screen, in pixel coordinates |
| `p1` | [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) | Second point on screen, in pixel coordinates |
| `bearing` | `number` | Desired map bearing at end of animation, in degrees |
| `options?` | [`FitBoundsOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

```ts
let p0 = [220, 400];
let p1 = [500, 900];
map.fitScreenCoordinates(p0, p1, map.getBearing(), {
  padding: {top: 10, bottom:25, left: 15, right: 5}
});
```

#### See

Used by [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>)

---

### flyTo()

> **flyTo**(`options`: [`FlyToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FlyToOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1517](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1517>)

Changes any combination of center, zoom, bearing, pitch, and roll, animating the transition along a curve that evokes flight. The animation seamlessly incorporates zooming and panning to help the user maintain her bearings even after traversing a great distance.

> [!NOTE]
>
> **Reduced Motion**
>
> The animation will be skipped, and this will behave equivalently to `jumpTo` if the user has the `reduced motion` accessibility feature enabled in their operating system, unless 'options' includes `essential: true`.

Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend`, `pitchstart`, `pitch`, `pitchend`, `rollstart`, `roll`, `rollend`, and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`FlyToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FlyToOptions/index.md>) | Options describing the destination and animation of the transition. Accepts [CameraOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/index.md>), [AnimationOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>), and the following additional options. |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

```ts
// fly with default options to null island
map.flyTo({center: [0, 0], zoom: 9});
// using flyTo options
map.flyTo({
  center: [0, 0],
  zoom: 9,
  speed: 0.2,
  curve: 1,
  easing(t) {
    return t;
  }
});
```

#### See

- [Fly to a location](<https://maplibre.org/maplibre-gl-js/docs/examples/fly-to-a-location/>)
- [Slowly fly to a location](<https://maplibre.org/maplibre-gl-js/docs/examples/slowly-fly-to-a-location/>)
- [Fly to a location based on scroll position](<https://maplibre.org/maplibre-gl-js/docs/examples/fly-to-a-location-based-on-scroll-position/>)

---

### getAnisotropicFilterPitch()

> **getAnisotropicFilterPitch**(): `number`

Defined in: [ui/map.ts:1958](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1958>)

Returns the map's anisotropic filter pitch. If the map is pitched beyond this threshold, anisotropic filtering will be applied to all raster layers.

#### Returns

`number`

The anisotropicFilterPitch

#### Example

```ts
let anisotropicFilterPitch = map.getAnisotropicFilterPitch();
```

---

### getBearing()

> **getBearing**(): `number`

Defined in: [ui/map.ts:1212](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1212>)

Returns the map's current bearing. The bearing is the compass direction that is "up"; for example, a bearing of 90° orients the map so that east is up.

#### Returns

`number`

The map's current bearing.

#### See

[Navigate the map with game-like controls](<https://maplibre.org/maplibre-gl-js/docs/examples/navigate-the-map-with-game-like-controls/>)

---

### getBounds()

> **getBounds**(): [`LngLatBounds`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>)

Defined in: [ui/map.ts:1712](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1712>)

Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.

#### Returns

[`LngLatBounds`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>)

The geographical bounds of the map as [LngLatBounds](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>).

#### Example

```ts
let bounds = map.getBounds();
```

---

### getCameraTargetElevation()

> **getCameraTargetElevation**(): `number`

Defined in: [ui/map.ts:4686](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4686>)

Returns the elevation for the point where the camera is looking. This value corresponds to: "meters above sea level" \* "exaggeration"

#### Returns

`number`

The elevation.

---

### getCanvas()

> **getCanvas**(): `HTMLCanvasElement`

Defined in: [ui/map.ts:4052](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4052>)

Returns the map's `<canvas>` element.

#### Returns

`HTMLCanvasElement`

The map's `<canvas>` element.

#### See

- [Measure distances](<https://maplibre.org/maplibre-gl-js/docs/examples/measure-distances/>)
- [Display a popup on hover](<https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/>)
- [Center the map on a clicked symbol](<https://maplibre.org/maplibre-gl-js/docs/examples/center-the-map-on-a-clicked-symbol/>)

---

### getCanvasContainer()

> **getCanvasContainer**(): `HTMLElement`

Defined in: [ui/map.ts:4040](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4040>)

Returns the HTML element containing the map's `<canvas>` element.

If you want to add non-GL overlays to the map, you should append them to this element.

This is the element to which event bindings for map interactivity (such as panning and zooming) are attached. It will receive bubbled events from child elements such as the `<canvas>`, but not from map controls.

#### Returns

`HTMLElement`

The container of the map's `<canvas>`.

#### See

[Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### getCenter()

> **getCenter**(): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [ui/map.ts:1041](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1041>)

Returns the map's geographical centerpoint.

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The map's geographical centerpoint.

#### Example

Return a LngLat object such as `{lng: 0, lat: 0}`

```ts
let center = map.getCenter();
// access longitude and latitude values directly
let {lng, lat} = map.getCenter();
```

---

### getCenterClampedToGround()

> **getCenterClampedToGround**(): `boolean`

Defined in: [ui/map.ts:1544](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1544>)

Returns the value of `centerClampedToGround`.

If true, the elevation of the center point will automatically be set to the terrain elevation (or zero if terrain is not enabled). If false, the elevation of the center point will default to sea level and will not automatically update. Defaults to true. Needs to be set to false to keep the camera above ground when pitch \> 90 degrees.

#### Returns

`boolean`

---

### getCenterElevation()

> **getCenterElevation**(): `number`

Defined in: [ui/map.ts:1060](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1060>)

Returns the elevation of the map's center point.

#### Returns

`number`

The elevation of the map's center point, in meters above sea level.

---

### getContainer()

> **getContainer**(): `HTMLElement`

Defined in: [ui/map.ts:4024](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4024>)

Returns the map's containing HTML element.

#### Returns

`HTMLElement`

The map's container.

---

### getFeatureState()

> **getFeatureState**(`feature`: [`FeatureIdentifier`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FeatureIdentifier/index.md>)): `any`

Defined in: [ui/map.ts:4015](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4015>)

Gets the `state` of a feature. A feature's `state` is a set of user-defined key-value pairs that are assigned to a feature at runtime. Features are identified by their `feature.id` attribute, which can be any number or string.

> [!NOTE]
>
> To access the values in a feature's state object for the purposes of styling the feature, use the [`feature-state` expression](<https://maplibre.org/maplibre-style-spec/expressions/#feature-state>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `feature` | [`FeatureIdentifier`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FeatureIdentifier/index.md>) | Feature identifier. Feature objects returned from [Map.queryRenderedFeatures](<#queryrenderedfeatures>) or event handlers can be used as feature identifiers. |

#### Returns

`any`

The state of the feature: a set of key-value pairs that was assigned to the feature at runtime.

#### Example

When the mouse moves over the `my-layer` layer, get the feature state for the feature under the mouse

```ts
map.on('mousemove', 'my-layer', (e) => {
  if (e.features.length > 0) {
    map.getFeatureState({
      source: 'my-source',
      sourceLayer: 'my-source-layer',
      id: e.features[0].id
    });
  }
});
```

---

### getFilter()

> **getFilter**(`layerId`: `string`): `void` | `FilterSpecification`

Defined in: [ui/map.ts:3645](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3645>)

Returns the filter applied to the specified style layer.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerId` | `string` | The ID of the style layer whose filter to get. |

#### Returns

`void` | `FilterSpecification`

The layer's filter.

---

### getFontFaces()

> **getFontFaces**(): `FontFacesSpecification`

Defined in: [ui/map.ts:3769](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3769>)

Returns the value of the style's `font-faces` property.

#### Returns

`FontFacesSpecification`

The style's font faces, or `null` if it declares none.

---

### getGlobalState()

> **getGlobalState**(): `Record`\<`string`, `any`\>

Defined in: [ui/map.ts:918](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L918>)

Returns the global map state

#### Returns

`Record`\<`string`, `any`\>

The map state object.

---

### getGlyphs()

> **getGlyphs**(): `string`

Defined in: [ui/map.ts:3731](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3731>)

Returns the value of the style's glyphs URL

#### Returns

`string`

glyphs Style's glyphs url, or `null` if glyphs are unset.

---

### getImage()

> **getImage**(`id`: `string`): [`StyleImage`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImage/index.md>)

Defined in: [ui/map.ts:3336](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3336>)

Returns an image, specified by ID, currently available in the map. This includes both images from the style's original sprite and any images that have been added at runtime using [Map.addImage](<#addimage>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the image. |

#### Returns

[`StyleImage`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImage/index.md>)

An image in the map with the specified ID.

#### Example

```ts
let coffeeShopIcon = map.getImage("coffee_cup");
```

---

### getLayer()

> **getLayer**(`id`: `string`): [`StyleLayer`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/StyleLayer/index.md>)

Defined in: [ui/map.ts:3557](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3557>)

Returns the layer with the specified ID in the map's style.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the layer to get. |

#### Returns

[`StyleLayer`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/StyleLayer/index.md>)

The layer with the specified ID, or `undefined` if the ID corresponds to no existing layers.

#### Example

```ts
let stateDataLayer = map.getLayer('state-data');
```

#### See

- [Filter symbols by toggling a list](<https://maplibre.org/maplibre-gl-js/docs/examples/filter-symbols-by-toggling-a-list/>)
- [Filter symbols by text input](<https://maplibre.org/maplibre-gl-js/docs/examples/filter-symbols-by-text-input/>)

---

### getLayersOrder()

> **getLayersOrder**(): `string`\[\]

Defined in: [ui/map.ts:3571](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3571>)

Return the ids of all layers currently in the style, including custom layers, in order.

#### Returns

`string`\[\]

ids of layers, in order

#### Example

```ts
const orderedLayerIds = map.getLayersOrder();
```

---

### getLayoutProperty()

> **getLayoutProperty**\<`K` *extends* keyof `AllLayoutProperties`\>(`layerId`: `string`, `name`: `K`): `AllLayoutProperties`\[`K`\]

Defined in: [ui/map.ts:3705](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3705>)

Returns the value of a layout property in the specified style layer.

#### Type Parameters

| Type Parameter |
| --- |
| `K` *extends* keyof `AllLayoutProperties` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerId` | `string` | The ID of the layer to get the layout property from. |
| `name` | `K` | The name of the layout property to get. |

#### Returns

`AllLayoutProperties`\[`K`\]

The value of the specified layout property.

---

### getLight()

> **getLight**(): `LightSpecification`

Defined in: [ui/map.ts:3861](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3861>)

Returns the value of the light object.

#### Returns

`LightSpecification`

light Light properties of the style.

---

### getMaxBounds()

> **getMaxBounds**(): [`LngLatBounds`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>)

Defined in: [ui/map.ts:1724](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1724>)

Returns the maximum geographical bounds the map is constrained to, or `null` if none set.

#### Returns

[`LngLatBounds`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>)

The map object.

#### Example

```ts
let maxBounds = map.getMaxBounds();
```

---

### getMaxPitch()

> **getMaxPitch**(): `number`

Defined in: [ui/map.ts:1946](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1946>)

Returns the map's maximum allowable pitch.

#### Returns

`number`

The maxPitch

---

### getMaxZoom()

> **getMaxZoom**(): `number`

Defined in: [ui/map.ts:1858](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1858>)

Returns the map's maximum allowable zoom level.

#### Returns

`number`

The maxZoom

#### Example

```ts
let maxZoom = map.getMaxZoom();
```

---

### getMinPitch()

> **getMinPitch**(): `number`

Defined in: [ui/map.ts:1902](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1902>)

Returns the map's minimum allowable pitch.

#### Returns

`number`

The minPitch

---

### getMinZoom()

> **getMinZoom**(`constrained?`: `boolean`): `number`

Defined in: [ui/map.ts:1807](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1807>)

Returns the map's minimum allowable zoom level.

#### Parameters

| Parameter | Type | Default value | Description |
| --- | --- | --- | --- |
| `constrained` | `boolean` | `false` | If `true`, returns the effective minimum zoom after applying the map's viewport constraints. If `false` or omitted, returns the configured minimum zoom. |

#### Returns

`number`

minZoom

#### Example

```ts
let minZoom = map.getMinZoom();
```

---

### getPadding()

> **getPadding**(): [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)

Defined in: [ui/map.ts:1247](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1247>)

Returns the current padding applied around the map viewport.

#### Returns

[`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)

The current padding around the map viewport.

---

### getPaintProperty()

> **getPaintProperty**\<`K` *extends* keyof `AllPaintProperties`\>(`layerId`: `string`, `name`: `K`): `AllPaintProperties`\[`K`\]

Defined in: [ui/map.ts:3677](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3677>)

Returns the value of a paint property in the specified style layer.

#### Type Parameters

| Type Parameter |
| --- |
| `K` *extends* keyof `AllPaintProperties` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerId` | `string` | The ID of the layer to get the paint property from. |
| `name` | `K` | The name of a paint property to get. |

#### Returns

`AllPaintProperties`\[`K`\]

The value of the specified paint property.

---

### getPitch()

> **getPitch**(): `number`

Defined in: [ui/map.ts:1308](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1308>)

Returns the map's current pitch (tilt).

#### Returns

`number`

The map's current pitch, measured in degrees away from the plane of the screen.

---

### getPixelRatio()

> **getPixelRatio**(): `number`

Defined in: [ui/map.ts:1686](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1686>)

Returns the map's pixel ratio. Note that the pixel ratio actually applied may be lower to respect maxCanvasSize.

#### Returns

`number`

The pixel ratio.

---

### getProjection()

> **getProjection**(): [`ProjectionSpecification`](<https://maplibre.org/maplibre-style-spec/projection/>)

Defined in: [ui/map.ts:4698](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4698>)

Gets the [ProjectionSpecification](<https://maplibre.org/maplibre-style-spec/projection/>).

#### Returns

[`ProjectionSpecification`](<https://maplibre.org/maplibre-style-spec/projection/>)

the projection specification.

#### Example

```ts
let projection = map.getProjection();
```

---

### getRenderWorldCopies()

> **getRenderWorldCopies**(): `boolean`

Defined in: [ui/map.ts:2004](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2004>)

Returns the state of `renderWorldCopies`. If `true`, multiple copies of the world will be rendered side by side beyond -180 and 180 degrees longitude. If set to `false`:

- When the map is zoomed out far enough that a single representation of the world does not fill the map's entire container, there will be blank space beyond 180 and -180 degrees longitude.
- Features that cross 180 and -180 degrees longitude will be cut in two (with one portion on the right edge of the map and the other on the left edge of the map) at every zoom level.

#### Returns

`boolean`

The renderWorldCopies

#### Example

```ts
let worldCopiesRendered = map.getRenderWorldCopies();
```

#### See

[Render world copies](<https://maplibre.org/maplibre-gl-js/docs/examples/render-world-copies/>)

---

### getRoll()

> **getRoll**(): `number`

Defined in: [ui/map.ts:1323](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1323>)

Returns the map's current roll angle.

#### Returns

`number`

The map's current roll, measured in degrees about the camera boresight.

---

### getSky()

> **getSky**(): `SkySpecification`

Defined in: [ui/map.ts:3891](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3891>)

Returns the value of the style's sky.

#### Returns

`SkySpecification`

the sky properties of the style.

#### Example

```ts
map.getSky();
```

---

### getSource()

> **getSource**\<`TSource` *extends* [`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>)\>(`id`: `string`): `TSource`

Defined in: [ui/map.ts:3093](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3093>)

Returns the source with the specified ID in the map's style.

This method is often used to update a source using the instance members for the relevant source type as defined in classes that derive from [Source](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>). For example, setting the `data` for a GeoJSON source or updating the `url` and `coordinates` of an image source.

#### Type Parameters

| Type Parameter |
| --- |
| `TSource` *extends* [`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the source to get. |

#### Returns

`TSource`

The style source with the specified ID or `undefined` if the ID corresponds to no existing sources. The shape of the object varies by source type. A list of options for each source type is available on the MapLibre Style Specification's [Sources](<https://maplibre.org/maplibre-style-spec/sources/>) page.

#### Example

```ts
let sourceObject = map.getSource('points');
```

#### See

- [Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)
- [Animate a point](<https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-point/>)
- [Add live realtime data](<https://maplibre.org/maplibre-gl-js/docs/examples/add-live-realtime-data/>)

---

### getSprite()

> **getSprite**(): `object`\[\]

Defined in: [ui/map.ts:3815](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3815>)

Returns the as-is value of the style's sprite.

#### Returns

`object`\[\]

style's sprite list of id-url pairs

---

### getStyle()

> **getStyle**(): `StyleSpecification`

Defined in: [ui/map.ts:2822](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2822>)

Returns the map's MapLibre style object, a JSON object which can be used to recreate the map's style.

#### Returns

`StyleSpecification`

The map's style JSON object.

#### Example

```ts
let styleJson = map.getStyle();
```

---

### getStyleUrl()

> **getStyleUrl**(): `string`

Defined in: [ui/map.ts:2838](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2838>)

Returns the URL the map's style was loaded from.

#### Returns

`string`

The URL given to [Map.setStyle](<#setstyle>) or the `style` map option, or `null` when the style was given as an object or the map has no style.

#### Example

```ts
const styleUrl = map.getStyleUrl();
```

---

### getTerrain()

> **getTerrain**(): `TerrainSpecification`

Defined in: [ui/map.ts:3033](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3033>)

Get the terrain-options if terrain is loaded

#### Returns

`TerrainSpecification`

the TerrainSpecification passed to setTerrain

#### Example

```ts
map.getTerrain(); // { source: 'terrain' };
```

---

### getVerticalFieldOfView()

> **getVerticalFieldOfView**(): `number`

Defined in: [ui/map.ts:1189](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1189>)

Returns the map's current vertical field of view, in degrees.

#### Returns

`number`

The map's current vertical field of view.

#### Default Value

```ts
36.87
```

#### Example

```ts
const verticalFieldOfView = map.getVerticalFieldOfView();
```

---

### getZoom()

> **getZoom**(): `number`

Defined in: [ui/map.ts:1116](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1116>)

Returns the map's current zoom level.

#### Returns

`number`

The map's current zoom level.

#### Example

```ts
map.getZoom();
```

---

### getZoomSnap()

> **getZoomSnap**(): `number`

Defined in: [ui/map.ts:1235](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1235>)

Returns the map's current zoom snap level.

#### Returns

`number`

The map's current zoom snap level.

---

### hasControl()

> **hasControl**(`control`: [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)): `boolean`

Defined in: [ui/map.ts:1003](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1003>)

Checks if a control exists on the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `control` | [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>) | The [IControl](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>) to check. |

#### Returns

`boolean`

true if map contains control.

#### Example

```ts
// Define a new navigation control.
let navigation = new NavigationControl();
// Add zoom and rotation controls to the map.
map.addControl(navigation);
// Check that the navigation control exists on the map.
map.hasControl(navigation);
```

---

### hasImage()

> **hasImage**(`id`: `string`): `boolean`

Defined in: [ui/map.ts:3356](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3356>)

Check whether or not an image with a specific ID exists in the style. This checks both images in the style's original sprite and any images that have been added at runtime using [Map.addImage](<#addimage>).

An [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) will be fired if the image ID is missing.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the image. |

#### Returns

`boolean`

A Boolean indicating whether the image exists.

#### Example

Check if an image with the ID 'cat' exists in the style's sprite.

```ts
let catIconExists = map.hasImage('cat');
```

---

### isMoving()

> **isMoving**(): `boolean`

Defined in: [ui/map.ts:2093](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2093>)

Returns true if the map is panning, zooming, rotating, or pitching due to a camera animation or user gesture.

#### Returns

`boolean`

true if the map is moving.

#### Example

```ts
let isMoving = map.isMoving();
```

---

### isRotating()

> **isRotating**(): `boolean`

Defined in: [ui/map.ts:2117](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2117>)

Returns true if the map is rotating due to a camera animation or user gesture.

#### Returns

`boolean`

true if the map is rotating.

#### Example

```ts
map.isRotating();
```

---

### isSourceLoaded()

> **isSourceLoaded**(`id`: `string`): `boolean`

Defined in: [ui/map.ts:2931](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2931>)

Returns a Boolean indicating whether the source is loaded. Returns `true` if the source with the given ID in the map's style has no outstanding network requests, otherwise `false`.

A [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) event will be fired if there is no source with the specified ID.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the source to be checked. |

#### Returns

`boolean`

A Boolean indicating whether the source is loaded.

#### Example

```ts
let sourceLoaded = map.isSourceLoaded('bathymetry-data');
```

---

### isStyleLoaded()

> **isStyleLoaded**(): `boolean` | `void`

Defined in: [ui/map.ts:2867](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2867>)

Returns a Boolean indicating whether the map's style is fully loaded.

#### Returns

`boolean` | `void`

A Boolean indicating whether the style is fully loaded.

#### Example

```ts
let styleLoadStatus = map.isStyleLoaded();
```

---

### isZooming()

> **isZooming**(): `boolean`

Defined in: [ui/map.ts:2105](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2105>)

Returns true if the map is zooming due to a camera animation or user gesture.

#### Returns

`boolean`

true if the map is zooming.

#### Example

```ts
let isZooming = map.isZooming();
```

---

### jumpTo()

> **jumpTo**(`options`: [`JumpToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/JumpToOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1420](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1420>)

Changes any combination of center, zoom, bearing, pitch, and roll, without an animated transition. The map will retain its current values for any details not specified in `options`.

Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend`, `pitchstart`, `pitch`, `pitchend`, `rollstart`, `roll`, `rollend` and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`JumpToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/JumpToOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

```ts
// jump to coordinates at current zoom
map.jumpTo({center: [0, 0]});
// jump with zoom, pitch, and bearing options
map.jumpTo({
  center: [0, 0],
  zoom: 8,
  pitch: 45,
  bearing: 90
});
```

#### See

- [Jump to a series of locations](<https://maplibre.org/maplibre-gl-js/docs/examples/jump-to-a-series-of-locations/>)
- [Update a feature in realtime](<https://maplibre.org/maplibre-gl-js/docs/examples/update-a-feature-in-realtime/>)

---

### listens()

> **listens**(`type`: keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`MapEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### listImages()

> **listImages**(): `string`\[\]

Defined in: [ui/map.ts:3419](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3419>)

Returns an Array of strings containing the IDs of all images currently available in the map. This includes both images from the style's original sprite and any images that have been added at runtime using [Map.addImage](<#addimage>).

#### Returns

`string`\[\]

An Array of strings containing the names of all sprites/images currently available in the map.

#### Example

```ts
let allImages = map.listImages();
```

---

### loaded()

> **loaded**(): `boolean`

Defined in: [ui/map.ts:4318](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4318>)

Returns a Boolean indicating whether the map is fully loaded.

Returns `false` if the style is not yet fully loaded, or if there has been a change to the sources or style that has not yet fully loaded.

#### Returns

`boolean`

A Boolean indicating whether the map is fully loaded.

---

### loadImage()

> **loadImage**(`url`: `string`): `Promise`\<[`GetResourceResponse`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GetResourceResponse/index.md>)\<`ImageBitmap` | `HTMLImageElement`\>\>

Defined in: [ui/map.ts:3399](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3399>)

Load an image from an external URL to be used with [Map.addImage](<#addimage>). External domains must support [CORS](<https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `url` | `string` | The URL of the image file. Image file must be in png, webp, or jpg format. |

#### Returns

`Promise`\<[`GetResourceResponse`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GetResourceResponse/index.md>)\<`ImageBitmap` | `HTMLImageElement`\>\>

a promise that is resolved when the image is loaded, or rejected when the response has no image data (for example an HTTP 204)

#### Example

Load an image from an external URL.

```ts
const response = await map.loadImage('https://picsum.photos/50/50');
// Add the loaded image to the style's sprite with the ID 'photo'.
map.addImage('photo', response.data);
```

#### See

[Add an icon to the map](<https://maplibre.org/maplibre-gl-js/docs/examples/add-an-icon-to-the-map/>)

---

### moveLayer()

> **moveLayer**(`id`: `string`, `beforeId?`: `string`): `this`

Defined in: [ui/map.ts:3520](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3520>)

Moves a layer to a different z-position.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the layer to move. |
| `beforeId?` | `string` | The ID of an existing layer to insert the new layer before. When viewing the map, the `id` layer will appear beneath the `beforeId` layer. If `beforeId` is omitted, the layer will be appended to the end of the layers array and appear above all other layers on the map. |

#### Returns

`this`

#### Example

Move a layer with ID 'polygon' before the layer with ID 'country-label'. The `polygon` layer will appear beneath the `country-label` layer on the map.

```ts
map.moveLayer('polygon', 'country-label');
```

---

### panBy()

> **panBy**(`offset`: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>), `options?`: [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1089](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1089>)

Pans the map by the specified offset.

Triggers the following events: `movestart` and `moveend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `offset` | [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) | `x` and `y` coordinates by which to pan the map. |
| `options?` | [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### See

[Navigate the map with game-like controls](<https://maplibre.org/maplibre-gl-js/docs/examples/navigate-the-map-with-game-like-controls/>)

---

### panTo()

> **panTo**(`lnglat`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>), `options?`: [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1106](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1106>)

Pans the map to the specified location with an animated transition.

Triggers the following events: `movestart` and `moveend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `lnglat` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | The location to pan the map to. |
| `options?` | [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>) | Options describing the destination and animation of the transition. |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

```ts
map.panTo([-74, 38]);
// Specify that the panTo animation should last 5000 milliseconds.
map.panTo([-74, 38], {duration: 5000});
```

#### See

[Update a feature in realtime](<https://maplibre.org/maplibre-gl-js/docs/examples/update-a-feature-in-realtime/>)

---

### project()

> **project**(`lnglat`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `Point`

Defined in: [ui/map.ts:2063](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2063>)

Returns a [Point](<https://github.com/mapbox/point-geometry>) representing pixel coordinates, relative to the map's `container`, that correspond to the specified geographical location.

A location behind the camera has no corresponding pixel. For such a location the returned point is outside the viewport, on the side through which the location left the screen, one viewport width or height away from the edge.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `lnglat` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | The geographical location to project. |

#### Returns

`Point`

The [Point](<https://github.com/mapbox/point-geometry>) corresponding to `lnglat`, relative to the map's `container`.

#### Example

```ts
let coordinate = [-122.420679, 37.772537];
let point = map.project(coordinate);
```

---

### queryRenderedFeatures()

> **queryRenderedFeatures**(`geometryOrOptions?`: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) | [`QueryRenderedFeaturesOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/QueryRenderedFeaturesOptions/index.md>) | \[[`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>), [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)\], `options?`: [`QueryRenderedFeaturesOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/QueryRenderedFeaturesOptions/index.md>)): [`MapGeoJSONFeature`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapGeoJSONFeature/index.md>)\[\]

Defined in: [ui/map.ts:2579](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2579>)

Returns an array of MapGeoJSONFeature objects representing visible features that satisfy the query parameters.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `geometryOrOptions?` | [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) \| [`QueryRenderedFeaturesOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/QueryRenderedFeaturesOptions/index.md>) \| \[[`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>), [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)\] | (optional) The geometry of the query region in pixel points within the map viewport: either a single pixel point or a pair of top-left and bottom-right pixel points describing a bounding box. The origin of the pixel points is at the top-left of the map viewport. Omitting this parameter (i.e. calling [Map.queryRenderedFeatures](<#queryrenderedfeatures>) with zero arguments, or with only a `options` argument) is equivalent to passing a bounding box encompassing the entire map viewport. The geometryOrOptions can receive a [QueryRenderedFeaturesOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/QueryRenderedFeaturesOptions/index.md>) only to support a situation where the function receives only one parameter which is the options parameter. |
| `options?` | [`QueryRenderedFeaturesOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/QueryRenderedFeaturesOptions/index.md>) | (optional) Options object. |

#### Returns

[`MapGeoJSONFeature`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapGeoJSONFeature/index.md>)\[\]

An array of MapGeoJSONFeature objects.

The `properties` value of each returned feature object contains the properties of its source feature. For GeoJSON sources, only string and numeric property values are supported (i.e. `null`, `Array`, and `Object` values are not supported).

Each feature includes top-level `layer`, `source`, and `sourceLayer` properties. The `layer` property is an object representing the style layer to which the feature belongs. Layout and paint properties in this object contain values which are fully evaluated for the given zoom level and feature.

Only features that are currently rendered are included. Some features will **not** be included, like:

- Features from layers whose `visibility` property is `"none"`.
- Features from layers whose zoom range excludes the current zoom level.
- Symbol features that have been hidden due to text or icon collision.

Features from all other layers are included, including features that may have no visible contribution to the rendered result; for example, because the layer's opacity or color alpha component is set to 0.

The topmost rendered feature appears first in the returned array, and subsequent features are sorted by descending z-order. Features that are rendered multiple times (due to wrapping across the antemeridian at low zoom levels) are returned only once (though subject to the following caveat).

Because features come from tiled vector data or GeoJSON data that is converted to tiles internally, feature geometries may be split or duplicated across tile boundaries and, as a result, features may appear multiple times in query results. For example, suppose there is a highway running through the bounding rectangle of a query. The results of the query will be those parts of the highway that lie within the map tiles covering the bounding rectangle, even if the highway extends into other tiles, and the portion of the highway within each map tile will be returned as a separate feature. Similarly, a point feature near a tile boundary may appear in multiple tiles due to tile buffering.

#### Examples

Find all features at a point

```ts
let features = map.queryRenderedFeatures(
  [20, 35],
  { layers: ['my-layer-name'] }
);
```

Find all features within a static bounding box

```ts
let features = map.queryRenderedFeatures(
  [[10, 20], [30, 50]],
  { layers: ['my-layer-name'] }
);
```

Find all features within a bounding box around a point

```ts
let width = 10;
let height = 20;
let features = map.queryRenderedFeatures([
  [point.x - width / 2, point.y - height / 2],
  [point.x + width / 2, point.y + height / 2]
], { layers: ['my-layer-name'] });
```

Query all rendered features from a single layer

```ts
let features = map.queryRenderedFeatures({ layers: ['my-layer-name'] });
```

#### See

[Get features under the mouse pointer](<https://maplibre.org/maplibre-gl-js/docs/examples/get-features-under-the-mouse-pointer/>)

---

### querySourceFeatures()

> **querySourceFeatures**(`sourceId`: `string`, `parameters?`: [`QuerySourceFeatureOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/QuerySourceFeatureOptions/index.md>)): [`GeoJSONFeature`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/GeoJSONFeature/index.md>)\[\]

Defined in: [ui/map.ts:2629](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2629>)

Returns an array of MapGeoJSONFeature objects representing features within the specified vector tile or GeoJSON source that satisfy the query parameters.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `sourceId` | `string` | The ID of the vector tile or GeoJSON source to query. |
| `parameters?` | [`QuerySourceFeatureOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/QuerySourceFeatureOptions/index.md>) | The options object. |

#### Returns

[`GeoJSONFeature`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/GeoJSONFeature/index.md>)\[\]

An array of MapGeoJSONFeature objects.

In contrast to [Map.queryRenderedFeatures](<#queryrenderedfeatures>), this function returns all features matching the query parameters, whether or not they are rendered by the current style (i.e. visible). The domain of the query includes all currently-loaded vector tiles and GeoJSON source tiles: this function does not check tiles outside the currently visible viewport.

Because features come from tiled vector data or GeoJSON data that is converted to tiles internally, feature geometries may be split or duplicated across tile boundaries and, as a result, features may appear multiple times in query results. For example, suppose there is a highway running through the bounding rectangle of a query. The results of the query will be those parts of the highway that lie within the map tiles covering the bounding rectangle, even if the highway extends into other tiles, and the portion of the highway within each map tile will be returned as a separate feature. Similarly, a point feature near a tile boundary may appear in multiple tiles due to tile buffering.

#### Example

Find all features in one source layer in a vector source

```ts
let features = map.querySourceFeatures('your-source-id', {
  sourceLayer: 'your-source-layer'
});
```

---

### queryTerrainElevation()

> **queryTerrainElevation**(`lngLatLike`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)): `number`

Defined in: [ui/map.ts:1530](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1530>)

Gets the elevation at a given location, in meters above sea level. Returns null if terrain is not enabled. If terrain is enabled with some exaggeration value, the value returned here will be reflective of (multiplied by) that exaggeration value. This method should be used for proper positioning of custom 3d objects, as explained [here](<https://maplibre.org/maplibre-gl-js/docs/examples/adding-3d-models-using-threejs-on-terrain/>)

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `lngLatLike` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | `[x, y]` or LngLat coordinates of the location |

#### Returns

`number`

elevation in meters

---

### redraw()

> **redraw**(): `this`

Defined in: [ui/map.ts:4505](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4505>)

Force a synchronous redraw of the map.

#### Returns

`this`

#### Example

```ts
map.redraw();
```

---

### refreshTiles()

> **refreshTiles**(`sourceId`: `string`, `tileIds?`: `object`\[\]): `void`

Defined in: [ui/map.ts:3143](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3143>)

Triggers a reload of the selected tiles

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `sourceId` | `string` | The ID of the source |
| `tileIds?` | `object`\[\] | An array of tile IDs to be reloaded. If not defined, all tiles will be reloaded. |

#### Returns

`void`

#### Example

```ts
map.refreshTiles('satellite', [{x:1024, y: 1023, z: 11}, {x:1023, y: 1023, z: 11}]);
```

---

### remove()

> **remove**(): `void`

Defined in: [ui/map.ts:4526](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4526>)

Clean up and release all internal resources associated with this map.

This includes DOM elements, event bindings, web workers, and WebGL resources.

Use this method when you are done using the map and wish to ensure that it no longer consumes browser resources. Afterwards, you must not call any other methods on the map.

#### Returns

`void`

---

### removeControl()

> **removeControl**(`control`: [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>)): `this`

Defined in: [ui/map.ts:977](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L977>)

Removes the control from the map.

An [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) will be fired if the control is invalid.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `control` | [`IControl`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>) | The [IControl](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/index.md>) to remove. |

#### Returns

`this`

#### Example

```ts
// Define a new navigation control.
let navigation = new NavigationControl();
// Add zoom and rotation controls to the map.
map.addControl(navigation);
// Remove zoom and rotation controls from the map.
map.removeControl(navigation);
```

---

### removeFeatureState()

> **removeFeatureState**(`target`: [`FeatureIdentifier`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FeatureIdentifier/index.md>), `key?`: `string`): `this`

Defined in: [ui/map.ts:3983](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3983>)

Removes the `state` of a feature, setting it back to the default behavior. If only a `target.source` is specified, it will remove the state for all features from that source. If `target.id` is also specified, it will remove all keys for that feature's state. If `key` is also specified, it removes only that key from that feature's state. Features are identified by their `feature.id` attribute, which can be any number or string.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `target` | [`FeatureIdentifier`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FeatureIdentifier/index.md>) | Identifier of where to remove state. It can be a source, a feature, or a specific key of feature. Feature objects returned from [Map.queryRenderedFeatures](<#queryrenderedfeatures>) or event handlers can be used as feature identifiers. |
| `key?` | `string` | (optional) The key in the feature state to reset. |

#### Returns

`this`

#### Examples

Reset the entire state object for all features in the `my-source` source

```ts
map.removeFeatureState({
  source: 'my-source'
});
```

When the mouse leaves the `my-layer` layer, reset the entire state object for the feature under the mouse

```ts
map.on('mouseleave', 'my-layer', (e) => {
  map.removeFeatureState({
    source: 'my-source',
    sourceLayer: 'my-source-layer',
    id: e.features[0].id
  });
});
```

When the mouse leaves the `my-layer` layer, reset only the `hover` key-value pair in the state for the feature under the mouse

```ts
map.on('mouseleave', 'my-layer', (e) => {
  map.removeFeatureState({
    source: 'my-source',
    sourceLayer: 'my-source-layer',
    id: e.features[0].id
  }, 'hover');
});
```

---

### removeImage()

> **removeImage**(`id`: `string`): `void`

Defined in: [ui/map.ts:3379](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3379>)

Remove an image from a style. This can be an image from the style's original sprite or any images that have been added at runtime using [Map.addImage](<#addimage>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the image. |

#### Returns

`void`

#### Example

```ts
// If an image with the ID 'cat' exists in
// the style's sprite, remove it.
if (map.hasImage('cat')) map.removeImage('cat');
```

---

### removeLayer()

> **removeLayer**(`id`: `string`): `this`

Defined in: [ui/map.ts:3538](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3538>)

Removes the layer with the given ID from the map's style.

An [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) will be fired if no such layer exists.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the layer to remove |

#### Returns

`this`

#### Example

If a layer with ID 'state-data' exists, remove it.

```ts
if (map.getLayer('state-data')) map.removeLayer('state-data');
```

---

### removeSource()

> **removeSource**(`id`: `string`): `this`

Defined in: [ui/map.ts:3066](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3066>)

Removes a source from the map's style.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the source to remove. |

#### Returns

`this`

#### Example

```ts
map.removeSource('bathymetry-data');
```

---

### removeSprite()

> **removeSprite**(`id`: `string`): `this`

Defined in: [ui/map.ts:3804](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3804>)

Removes the sprite from the map's style. Fires the `style` event.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the sprite to remove. If the sprite is declared as a single URL, the ID must be "default". |

#### Returns

`this`

#### Example

```ts
map.removeSprite('sprite-two');
map.removeSprite('default');
```

---

### resetNorth()

> **resetNorth**(`options?`: [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1283](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1283>)

Rotates the map so that north is up (0° bearing), with an animated transition.

Triggers the following events: `movestart`, `moveend`, and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

---

### resetNorthPitch()

> **resetNorthPitch**(`options?`: [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1292](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1292>)

Rotates and pitches the map so that north is up (0° bearing) and pitch and roll are 0°, with an animated transition.

Triggers the following events: `movestart`, `move`, `moveend`, `pitchstart`, `pitch`, `pitchend`, `rollstart`, `roll`, `rollend`, and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

---

### resize()

> **resize**(`eventData?`: `any`, `constrainTransform?`: `boolean`): `this`

Defined in: [ui/map.ts:1595](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1595>)

Resizes the map according to the dimensions of its `container` element.

Checks if the map container size changed and updates the map if it has changed. With the default `trackResize: true`, container size changes are picked up automatically, including a container that becomes visible after being hidden with CSS. Call this method explicitly when `trackResize` is `false`, or when the map's size changes in a way the container's `ResizeObserver` cannot observe.

Triggers the following events: `movestart`, `move`, `moveend`, and `resize`.

#### Parameters

| Parameter | Type | Default value | Description |
| --- | --- | --- | --- |
| `eventData?` | `any` | `undefined` | Additional properties to be passed to `movestart`, `move`, `resize`, and `moveend` events that get triggered as a result of resize. This can be useful for differentiating the source of an event (for example, user-initiated or programmatically-triggered events). |
| `constrainTransform?` | `boolean` | `true` | \- |

#### Returns

`this`

#### Example

Resize a map with `trackResize` disabled when its container is shown after being hidden with CSS.

```ts
let mapDiv = document.getElementById('map');
if (mapDiv.style.visibility === 'visible') map.resize();
```

---

### rotateTo()

> **rotateTo**(`bearing`: `number`, `options?`: [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1274](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1274>)

Rotates the map to the specified bearing, with an animated transition. The bearing is the compass direction that is "up"; for example, a bearing of 90° orients the map so that east is up.

Triggers the following events: `movestart`, `moveend`, and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `bearing` | `number` | The desired bearing. |
| `options?` | [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

---

### setAnisotropicFilterPitch()

> **setAnisotropicFilterPitch**(`anisotropicFilterPitch?`: `number`): `this`

Defined in: [ui/map.ts:1974](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1974>)

Sets the map's anisotropic filter pitch or reverts it to its default.

A [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) event will be fired if anisotropicFilterPitch is out of bounds.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `anisotropicFilterPitch?` | `number` | The pitch above which to apply anisotropic filtering to the map's raster layers (0-180). If `null` or `undefined` is provided, the function reverts to the default pitch threshold (20). |

#### Returns

`this`

#### Example

```ts
map.setAnisotropicFilterPitch(85);
```

---

### setBearing()

> **setBearing**(`bearing`: `number`, `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1229](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1229>)

Sets the map's bearing (rotation). The bearing is the compass direction that is "up"; for example, a bearing of 90° orients the map so that east is up.

Equivalent to `jumpTo({bearing: bearing})`.

Triggers the following events: `movestart`, `moveend`, and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `bearing` | `number` | The desired bearing. |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

Rotate the map to 90 degrees

```ts
map.setBearing(90);
```

---

### setCenter()

> **setCenter**(`center`: [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>), `eventData?`: `Record`\<`string`, `unknown`\>): `this`

Defined in: [ui/map.ts:1054](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1054>)

Sets the map's geographical centerpoint. Equivalent to `jumpTo({center: center})`.

Triggers the following events: `movestart` and `moveend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `center` | [`LngLatLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>) | The centerpoint to set. |
| `eventData?` | `Record`\<`string`, `unknown`\> | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

```ts
map.setCenter([-74, 38]);
```

---

### setCenterClampedToGround()

> **setCenterClampedToGround**(`centerClampedToGround`: `boolean`): `void`

Defined in: [ui/map.ts:1078](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1078>)

Sets the value of `centerClampedToGround`.

If true, the elevation of the center point will automatically be set to the terrain elevation (or zero if terrain is not enabled). If false, the elevation of the center point will default to sea level and will not automatically update. Defaults to true. Needs to be set to false to keep the camera above ground when pitch \> 90 degrees.

#### Parameters

| Parameter | Type |
| --- | --- |
| `centerClampedToGround` | `boolean` |

#### Returns

`void`

---

### setCenterElevation()

> **setCenterElevation**(`elevation`: `number`, `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1069](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1069>)

Sets the elevation of the map's center point, in meters above sea level. Equivalent to `jumpTo({elevation: elevation})`.

Triggers the following events: `movestart` and `moveend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `elevation` | `number` | The elevation to set, in meters above sea level. |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

---

### setEventedParent()

> **setEventedParent**(`parent?`: [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>, `data?`: [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) | (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>))): `this`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/evented.ts#L217>)

Bubble all events fired by this instance of Evented to this parent instance of Evented.

#### Parameters

| Parameter | Type |
| --- | --- |
| `parent?` | [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\> |
| `data?` | [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) \| (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>)) |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`setEventedParent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#seteventedparent>)

---

### setFeatureState()

> **setFeatureState**(`feature`: [`FeatureIdentifier`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FeatureIdentifier/index.md>), `state`: `any`): `this`

Defined in: [ui/map.ts:3932](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3932>)

Sets the `state` of a feature. A feature's `state` is a set of user-defined key-value pairs that are assigned to a feature at runtime. When using this method, the `state` object is merged with any existing key-value pairs in the feature's state. Features are identified by their `feature.id` attribute, which can be any number or string.

This method can only be used with sources that have a `feature.id` attribute. The `feature.id` attribute can be defined in three ways:

- For vector or GeoJSON sources, including an `id` attribute in the original data file.
- For vector or GeoJSON sources, using the [`promoteId`](<https://maplibre.org/maplibre-style-spec/sources/#promoteid>) option at the time the source is defined.
- For GeoJSON sources, using the [`generateId`](<https://maplibre.org/maplibre-style-spec/sources/#generateid>) option to auto-assign an `id` based on the feature's index in the source data. If you change feature data using `map.getSource('some id').setData(..)`, you may need to re-apply state taking into account updated `id` values.

> [!NOTE]
>
> You can use the [`feature-state` expression](<https://maplibre.org/maplibre-style-spec/expressions/#feature-state>) to access the values in a feature's state object for the purposes of styling.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `feature` | [`FeatureIdentifier`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FeatureIdentifier/index.md>) | Feature identifier. Feature objects returned from [Map.queryRenderedFeatures](<#queryrenderedfeatures>) or event handlers can be used as feature identifiers. |
| `state` | `any` | A set of key-value pairs. The values should be valid JSON types. |

#### Returns

`this`

#### Example

```ts
// When the mouse moves over the `my-layer` layer, update
// the feature state for the feature under the mouse
map.on('mousemove', 'my-layer', (e) => {
  if (e.features.length > 0) {
    map.setFeatureState({
      source: 'my-source',
      sourceLayer: 'my-source-layer',
      id: e.features[0].id,
    }, {
      hover: true
    });
  }
});
```

#### See

[Create a hover effect](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/>)

---

### setFilter()

> **setFilter**(`layerId`: `string`, `filter?`: `FilterSpecification`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:3634](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3634>)

Sets the filter for the specified style layer.

Filters control which features a style layer renders from its source. Any feature for which the filter expression evaluates to `true` will be rendered on the map. Those that are false will be hidden.

Use `setFilter` to show a subset of your source data.

To clear the filter, pass `null` or `undefined` as the second parameter.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerId` | `string` | The ID of the layer to which the filter will be applied. |
| `filter?` | `FilterSpecification` | The filter, conforming to the MapLibre Style Specification's [filter definition](<https://maplibre.org/maplibre-style-spec/layers/#filter>). If `null` or `undefined` is provided, the function removes any existing filter from the layer. |
| `options?` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | Options object. |

#### Returns

`this`

#### Examples

Display only features with the 'name' property 'USA'

```ts
map.setFilter('my-layer', ['==', ['get', 'name'], 'USA']);
```

Display only features with five or more 'available-spots'

```ts
map.setFilter('bike-docks', ['>=', ['get', 'available-spots'], 5]);
```

Remove the filter for the 'bike-docks' style layer

```ts
map.setFilter('bike-docks', null);
```

#### See

[Create a timeline animation](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-time-slider/>)

---

### setFontFaces()

> **setFontFaces**(`fontFaces`: `FontFacesSpecification`): `this`

Defined in: [ui/map.ts:3758](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3758>)

Sets the value of the style's `font-faces` property, which points at the font files used to draw text that the style's `glyphs` URL does not cover. Pass a falsy value (null or undefined) to unset it.

The files are handed to the browser's CSS Font Loading API, so any format the browser can render text with may be used, and requests for them go through `transformRequest` as glyph requests do. Text is drawn a grapheme cluster at a time, so a letter and the marks written on it are handed to the browser's text engine together and come back as the one shape they are written as -- which is what a `glyphs` URL, serving one codepoint at a time, cannot do.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `fontFaces` | `FontFacesSpecification` | The font faces to set. Must conform to the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/root/#font-faces>). A declaration this cannot make sense of is skipped with a warning, as is a font file that fails to load, so the text it would have drawn falls back to the `glyphs` URL. |

#### Returns

`this`

#### Example

```ts
map.setFontFaces({
    'Noto Sans Regular': [
        {url: 'https://example.com/NotoSansKhmer-Regular.ttf', 'unicode-range': ['U+1780-17FF']}
    ]
});
```

---

### setGlobalStateProperty()

> **setGlobalStateProperty**(`propertyName`: `string`, `value`: `any`): `this`

Defined in: [ui/map.ts:908](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L908>)

Sets a global state property that can be retrieved with the [`global-state` expression](<https://maplibre.org/maplibre-style-spec/expressions/#global-state>). If the value is null, it resets the property to its default value defined in the [`state` style property](<https://maplibre.org/maplibre-style-spec/root/#state>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `propertyName` | `string` | The name of the state property to set. |
| `value` | `any` | The value of the state property to set. |

#### Returns

`this`

---

### setGlyphs()

> **setGlyphs**(`glyphsUrl`: `string`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:3720](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3720>)

Sets the value of the style's glyphs property. Pass a falsy value (null or undefined) to unset glyphs. \* \*

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `glyphsUrl` | `string` | Glyph URL to set. Must conform to the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/glyphs/>). \* |
| `options` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | Options object. \* |

#### Returns

`this`

#### Example

- \`\`\`ts
- map.setGlyphs('https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf');
- \`\`\`

---

### setLayerZoomRange()

> **setLayerZoomRange**(`layerId`: `string`, `minzoom`: `number`, `maxzoom`: `number`): `this`

Defined in: [ui/map.ts:3596](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3596>)

Sets the zoom extent for the specified style layer. The zoom extent includes the [minimum zoom level](<https://maplibre.org/maplibre-style-spec/layers/#minzoom>) and [maximum zoom level](<https://maplibre.org/maplibre-style-spec/layers/#maxzoom>)) at which the layer will be rendered.

> [!NOTE]
>
> For style layers using vector sources, style layers cannot be rendered at zoom levels lower than the minimum zoom level of the *source layer* because the data does not exist at those zoom levels. If the minimum zoom level of the source layer is higher than the minimum zoom level defined in the style layer, the style layer will not be rendered at all zoom levels in the zoom range.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerId` | `string` | The ID of the layer to which the zoom extent will be applied. |
| `minzoom` | `number` | The minimum zoom to set (0-24). |
| `maxzoom` | `number` | The maximum zoom to set (0-24). |

#### Returns

`this`

#### Example

```ts
map.setLayerZoomRange('my-layer', 2, 5);
```

---

### setLayoutProperty()

> **setLayoutProperty**\<`K` *extends* keyof `AllLayoutProperties`\>(`layerId`: `string`, `name`: `K`, `value`: `AllLayoutProperties`\[`K`\], `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:3693](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3693>)

Sets the value of a layout property in the specified style layer.

#### Type Parameters

| Type Parameter |
| --- |
| `K` *extends* keyof `AllLayoutProperties` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerId` | `string` | The ID of the layer to set the layout property in. |
| `name` | `K` | The name of the layout property to set. |
| `value` | `AllLayoutProperties`\[`K`\] | The value of the layout property. Must be of a type appropriate for the property, as defined in the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/>). |
| `options` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | The options object. |

#### Returns

`this`

#### Example

```ts
map.setLayoutProperty('my-layer', 'visibility', 'none');
```

---

### setLight()

> **setLight**(`light`: `LightSpecification`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:3850](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3850>)

Sets the any combination of light values.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `light` | `LightSpecification` | Light properties to set. Must conform to the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/light>). |
| `options` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | Options object. |

#### Returns

`this`

#### Example

```ts
let layerVisibility = map.getLayoutProperty('my-layer', 'visibility');
```

---

### setMaxBounds()

> **setMaxBounds**(`bounds?`: [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>)): `this`

Defined in: [ui/map.ts:1749](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1749>)

Sets or clears the map's geographical bounds.

Pan and zoom operations are constrained within these bounds. If a pan or zoom is performed that would display regions outside these bounds, the map will instead display a position and zoom level as close as possible to the operation's request while still remaining within the bounds.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `bounds?` | [`LngLatBoundsLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>) | The maximum bounds to set. If `null` or `undefined` is provided, the function removes the map's maximum bounds. |

#### Returns

`this`

#### Example

Define bounds that conform to the `LngLatBoundsLike` object as set the max bounds.

```ts
let bounds = [
  [-74.04728, 40.68392], // [west, south]
  [-73.91058, 40.87764]  // [east, north]
];
map.setMaxBounds(bounds);
```

---

### setMaxPitch()

> **setMaxPitch**(`maxPitch?`: `number`): `this`

Defined in: [ui/map.ts:1915](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1915>)

Sets or clears the map's maximum pitch. If the map's current pitch is higher than the new maximum, the map will pitch to the new maximum and trigger the following events: `movestart`, `move`, `moveend`, `pitchstart`, `pitch`, and `pitchend`.

A [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) event will be fired if maxPitch is out of bounds.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `maxPitch?` | `number` | The maximum pitch to set (0-180). Values greater than 60 degrees are experimental and may result in rendering issues. If you encounter any, please raise an issue with details in the MapLibre project. If `null` or `undefined` is provided, the function removes the current maximum pitch (sets it to 60). |

#### Returns

`this`

---

### setMaxZoom()

> **setMaxZoom**(`maxZoom?`: `number`): `this`

Defined in: [ui/map.ts:1827](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1827>)

Sets or clears the map's maximum zoom level. If the map's current zoom level is higher than the new maximum, the map will zoom to the new maximum and trigger the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.

A [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) event will be fired if minZoom is out of bounds.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `maxZoom?` | `number` | The maximum zoom level to set. If `null` or `undefined` is provided, the function removes the current maximum zoom (sets it to 22). |

#### Returns

`this`

#### Example

```ts
map.setMaxZoom(18.75);
```

---

### setMinPitch()

> **setMinPitch**(`minPitch?`: `number`): `this`

Defined in: [ui/map.ts:1871](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1871>)

Sets or clears the map's minimum pitch. If the map's current pitch is lower than the new minimum, the map will pitch to the new minimum and trigger the following events: `movestart`, `move`, `moveend`, `pitchstart`, `pitch`, and `pitchend`.

A [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) event will be fired if minPitch is out of bounds.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `minPitch?` | `number` | The minimum pitch to set (0-180). Values greater than 60 degrees are experimental and may result in rendering issues. If you encounter any, please raise an issue with details in the MapLibre project. If `null` or `undefined` is provided, the function removes the current minimum pitch (i.e. sets it to 0). |

#### Returns

`this`

---

### setMinZoom()

> **setMinZoom**(`minZoom?`: `number`): `this`

Defined in: [ui/map.ts:1774](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1774>)

Sets or clears the map's minimum zoom level. If the map's current zoom level is lower than the new minimum, the map will zoom to the new minimum and trigger the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.

It is not always possible to zoom out and reach the set `minZoom`. Other factors such as map height may restrict zooming. For example, if the map is 512px tall it will not be possible to zoom below zoom 0 no matter what the `minZoom` is set to.

A [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) event will be fired if minZoom is out of bounds.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `minZoom?` | `number` | The minimum zoom level to set (-2 - 24). If `null` or `undefined` is provided, the function removes the current minimum zoom (i.e. sets it to -2). |

#### Returns

`this`

#### Example

```ts
map.setMinZoom(12.25);
```

---

### setMissingStyleImageResolver()

> **setMissingStyleImageResolver**(`resolver`: [`MissingStyleImageResolver`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MissingStyleImageResolver/index.md>)): `this`

Defined in: [ui/map.ts:3220](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3220>)

Sets a callback that is invoked when an icon or pattern needed by the style is missing.

The resolver typically loads or generates the image and registers it with [Map.addImage](<#addimage>). MapLibre awaits the returned promise before treating the image as missing, so async work is supported. If the image is still missing afterwards, the `styleimagemissing` event is fired.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `resolver` | [`MissingStyleImageResolver`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MissingStyleImageResolver/index.md>) | Callback used to resolve missing images, or `null` to remove the resolver. |

#### Returns

`this`

#### Example

```ts
map.setMissingStyleImageResolver(async (id) => {
    const response = await fetch(`/icons/${id}.png`);
    const image = await createImageBitmap(await response.blob());
    map.addImage(id, image, {pixelRatio: 2});
});
```

---

### setPadding()

> **setPadding**(`padding`: [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1263](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1263>)

Sets the padding in pixels around the viewport.

Equivalent to `jumpTo({padding: padding})`.

Triggers the following events: `movestart` and `moveend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `padding` | [`PaddingOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>) | The desired padding. |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

Sets a left padding of 300px, and a top padding of 50px

```ts
map.setPadding({ left: 300, top: 50 });
```

---

### setPaintProperty()

> **setPaintProperty**\<`K` *extends* keyof `AllPaintProperties`\>(`layerId`: `string`, `name`: `K`, `value`: `AllPaintProperties`\[`K`\], `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:3665](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3665>)

Sets the value of a paint property in the specified style layer.

#### Type Parameters

| Type Parameter |
| --- |
| `K` *extends* keyof `AllPaintProperties` |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `layerId` | `string` | The ID of the layer to set the paint property in. |
| `name` | `K` | The name of the paint property to set. |
| `value` | `AllPaintProperties`\[`K`\] | The value of the paint property to set. Must be of a type appropriate for the property, as defined in the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/>). Pass `null` to unset the existing value. |
| `options` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | Options object. |

#### Returns

`this`

#### Example

```ts
map.setPaintProperty('my-layer', 'fill-color', '#faafee');
```

#### See

- [Change a layer's color with buttons](<https://maplibre.org/maplibre-gl-js/docs/examples/change-a-layers-color-with-buttons/>)
- [Create a draggable point](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/>)

---

### setPitch()

> **setPitch**(`pitch`: `number`, `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1317](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1317>)

Sets the map's pitch (tilt). Equivalent to `jumpTo({pitch: pitch})`.

Triggers the following events: `movestart`, `moveend`, `pitchstart`, and `pitchend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `pitch` | `number` | The pitch to set, measured in degrees away from the plane of the screen (0-60). |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

---

### setPixelRatio()

> **setPixelRatio**(`pixelRatio`: `number`): `void`

Defined in: [ui/map.ts:1698](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1698>)

Sets the map's pixel ratio. This allows to override `devicePixelRatio`. After this call, the canvas' `width` attribute will be `container.clientWidth * pixelRatio` and its height attribute will be `container.clientHeight * pixelRatio`. Set this to null to disable `devicePixelRatio` override. Note that the pixel ratio actually applied may be lower to respect maxCanvasSize.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `pixelRatio` | `number` | The pixel ratio. |

#### Returns

`void`

---

### setProjection()

> **setProjection**(`projection`: [`ProjectionSpecification`](<https://maplibre.org/maplibre-style-spec/projection/>)): `this`

Defined in: [ui/map.ts:4705](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4705>)

Sets the [ProjectionSpecification](<https://maplibre.org/maplibre-style-spec/projection/>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `projection` | [`ProjectionSpecification`](<https://maplibre.org/maplibre-style-spec/projection/>) | the projection specification to set |

#### Returns

`this`

---

### setRenderWorldCopies()

> **setRenderWorldCopies**(`renderWorldCopies?`: `boolean`): `this`

Defined in: [ui/map.ts:2023](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2023>)

Sets the state of `renderWorldCopies`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `renderWorldCopies?` | `boolean` | If `true`, multiple copies of the world will be rendered side by side beyond -180 and 180 degrees longitude. If set to `false`: - When the map is zoomed out far enough that a single representation of the world does not fill the map's entire container, there will be blank space beyond 180 and -180 degrees longitude. - Features that cross 180 and -180 degrees longitude will be cut in two (with one portion on the right edge of the map and the other on the left edge of the map) at every zoom level. `undefined` is treated as `true`, `null` is treated as `false`. |

#### Returns

`this`

#### Example

```ts
map.setRenderWorldCopies(true);
```

#### See

[Render world copies](<https://maplibre.org/maplibre-gl-js/docs/examples/render-world-copies/>)

---

### setRoll()

> **setRoll**(`roll`: `number`, `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1332](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1332>)

Sets the map's roll angle. Equivalent to `jumpTo({roll: roll})`.

Triggers the following events: `movestart`, `moveend`, `rollstart`, and `rollend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `roll` | `number` | The roll to set, measured in degrees about the camera boresight |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

---

### setSky()

> **setSky**(`sky`: `SkySpecification`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:3876](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3876>)

Sets the value of style's sky properties.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `sky` | `SkySpecification` | Sky properties to set. Must conform to the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/sky/>). |
| `options` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | Options object. |

#### Returns

`this`

#### Example

```ts
map.setSky({'atmosphere-blend': 1.0});
```

---

### setSourceTileLodParams()

> **setSourceTileLodParams**(`maxZoomLevelsOnScreen`: `number`, `tileCountMaxMinRatio`: `number`, `sourceId?`: `string`): `this`

Defined in: [ui/map.ts:3117](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3117>)

Change the tile Level of Detail behavior of the specified source. These parameters have no effect when pitch == 0, and the largest effect when the horizon is visible on screen.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `maxZoomLevelsOnScreen` | `number` | The maximum number of distinct zoom levels allowed on screen at a time. There will generally be fewer zoom levels on the screen, the maximum can only be reached when the horizon is at the top of the screen. Increasing the maximum number of zoom levels causes the zoom level to decay faster toward the horizon. |
| `tileCountMaxMinRatio` | `number` | The ratio of the maximum number of tiles loaded (at high pitch) to the minimum number of tiles loaded. Increasing this ratio allows more tiles to be loaded at high pitch angles. If the ratio would otherwise be exceeded, the zoom level is reduced uniformly to keep the number of tiles within the limit. |
| `sourceId?` | `string` | The ID of the source to set tile LOD parameters for. All sources will be updated if unspecified. If `sourceId` is specified but a corresponding source does not exist, an error is thrown. |

#### Returns

`this`

#### Example

```ts
map.setSourceTileLodParams(4.0, 3.0, 'terrain');
```

#### See

[Modify Level of Detail behavior](<https://maplibre.org/maplibre-gl-js/docs/examples/level-of-detail-control/>)

---

### setSprite()

> **setSprite**(`spriteUrl`: `string`, `options?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:3829](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3829>)

Sets the value of the style's sprite property.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `spriteUrl` | `string` | Sprite URL to set. |
| `options` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | Options object. |

#### Returns

`this`

#### Example

```ts
map.setSprite('YOUR_SPRITE_URL');
```

---

### setStyle()

> **setStyle**(`style`: `string` | `StyleSpecification`, `options?`: [`StyleSwapOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSwapOptions/index.md>) &amp; [`StyleOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleOptions/index.md>)): `this`

Defined in: [ui/map.ts:2680](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2680>)

Updates the map's MapLibre style object with a new value.

If a style is already set when this is used and options.diff is set to true, the map renderer will attempt to compare the given style against the map's current state and perform only the changes necessary to make the map style match the desired state. Changes in sprites (images used for icons and patterns) and glyphs (fonts for label text) **cannot** be diffed. If the sprites or fonts used in the current style and the given style are different in any way, the map renderer will force a full update, removing the current style and building the given one from scratch.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `style` | `string` \| `StyleSpecification` | A JSON object conforming to the schema described in the [MapLibre Style Specification](<https://maplibre.org/maplibre-style-spec/>), or a URL to such JSON. |
| `options?` | [`StyleSwapOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSwapOptions/index.md>) &amp; [`StyleOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleOptions/index.md>) | The options object. |

#### Returns

`this`

#### Example

```ts
map.setStyle("https://demotiles.maplibre.org/style.json");

map.setStyle('https://demotiles.maplibre.org/style.json', {
  transformStyle: (previousStyle, nextStyle) => ({
      ...nextStyle,
      sources: {
          ...nextStyle.sources,
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

---

### setTerrain()

> **setTerrain**(`options`: `TerrainSpecification`, `styleOptions?`: [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>)): `this`

Defined in: [ui/map.ts:2951](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2951>)

Loads a 3D terrain mesh, based on a "raster-dem" source.

Triggers the `terrain` event.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | `TerrainSpecification` | Options object. |
| `styleOptions` | [`StyleSetterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleSetterOptions/index.md>) | \- |

#### Returns

`this`

#### Example

```ts
map.setTerrain({ source: 'terrain' });
```

---

### setTransformCameraUpdate()

> **setTransformCameraUpdate**(`value`: [`CameraUpdateTransformFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraUpdateTransformFunction/index.md>)): `void`

Defined in: [ui/map.ts:1027](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1027>)

Sets the callback used to defer camera updates or apply arbitrary constraints. If specified, this Camera instance can be used as a stateless component in React etc.

#### Parameters

| Parameter | Type |
| --- | --- |
| `value` | [`CameraUpdateTransformFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraUpdateTransformFunction/index.md>) |

#### Returns

`void`

---

### setTransformConstrain()

> **setTransformConstrain**(`constrain?`: [`TransformConstrainFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformConstrainFunction/index.md>)): `this`

Defined in: [ui/map.ts:2042](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2042>)

Sets or clears the callback overriding how the map constrains the viewport's lnglat and zoom to respect the longitude and latitude bounds.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `constrain?` | [`TransformConstrainFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformConstrainFunction/index.md>) | A [TransformConstrainFunction](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/TransformConstrainFunction/index.md>) callback defining how the viewport should respect the bounds. `null` clears the callback and reverts the constrain to the map transform's default constrain function. |

#### Returns

`this`

#### Example

```ts
function customTransformConstrain(lngLat, zoom) {
  return {center: lngLat, zoom: zoom ?? 0};
};
map.setTransformConstrain(customTransformConstrain);
```

#### See

[Customize the map transform constrain](<https://maplibre.org/maplibre-gl-js/docs/examples/customize-the-map-transform-constrain/>)

---

### setTransformRequest()

> **setTransformRequest**(`transformRequest`: [`RequestTransformFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestTransformFunction/index.md>)): `this`

Defined in: [ui/map.ts:2708](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2708>)

Updates the requestManager's transform request with a new function

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `transformRequest` | [`RequestTransformFunction`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RequestTransformFunction/index.md>) | A callback run before the Map makes a request for an external URL. The callback can be used to modify the url, set headers, or set the credentials property for cross-origin requests. Expected to return an object with a `url` property and optionally `headers` and `credentials` properties |

#### Returns

`this`

#### Example

```ts
map.setTransformRequest((url: string, resourceType: string) => {});
```

---

### setVerticalFieldOfView()

> **setVerticalFieldOfView**(`fov`: `number`, `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1204](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1204>)

Sets the map's vertical field of view, in degrees.

Triggers the following events: `movestart`, `move`, and `moveend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `fov` | `number` | The vertical field of view to set, in degrees (0-180). |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Default Value

```ts
36.87
```

#### Example

Change vertical field of view to 30 degrees

```ts
map.setVerticalFieldOfView(30);
```

---

### setZoom()

> **setZoom**(`zoom`: `number`, `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1130](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1130>)

Sets the map's zoom level. Equivalent to `jumpTo({zoom: zoom})`.

Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `zoom` | `number` | The zoom level to set (0-20). |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

Zoom to the zoom level 5 without an animated transition

```ts
map.setZoom(5);
```

---

### setZoomSnap()

> **setZoomSnap**(`snap`: `number`): `this`

Defined in: [ui/map.ts:1241](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1241>)

Sets the map's zoom snap level.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `snap` | `number` | The zoom snap level to set. |

#### Returns

`this`

---

### snapToNorth()

> **snapToNorth**(`options?`: [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1302](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1302>)

Snaps the map so that north is up (0° bearing), if the current bearing is close enough to it (i.e. within the `bearingSnap` threshold).

Triggers the following events: `movestart`, `moveend`, and `rotate`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

---

### stop()

> **stop**(): `this`

Defined in: [ui/map.ts:1521](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1521>)

Stops any animated transition underway.

#### Returns

`this`

---

### triggerRepaint()

> **triggerRepaint**(): `void`

Defined in: [ui/map.ts:4567](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L4567>)

Trigger the rendering of a single frame. Use this method with custom layers to repaint the map when the layer changes. Calling this multiple times before the next frame is rendered will still result in only a single frame being rendered.

#### Returns

`void`

#### Example

```ts
map.triggerRepaint();
```

#### See

- [Add a 3D model](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/>)
- [Add an animated icon to the map](<https://maplibre.org/maplibre-gl-js/docs/examples/add-an-animated-icon-to-the-map/>)

---

### unproject()

> **unproject**(`point`: [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)): [`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

Defined in: [ui/map.ts:2081](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L2081>)

Returns a [LngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) representing geographical coordinates that correspond to the specified pixel coordinates.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `point` | [`PointLike`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>) | The pixel coordinates to unproject. |

#### Returns

[`LngLat`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)

The [LngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>) corresponding to `point`.

#### Example

```ts
map.on('click', (e) => {
  // When the map is clicked, get the geographic coordinate.
  let coordinate = map.unproject(e.point);
});
```

---

### updateImage()

> **updateImage**(`id`: `string`, `image`: [`StyleImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageSource/index.md>)): `this`

Defined in: [ui/map.ts:3288](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L3288>)

Update an existing image in a style. This image can be displayed on the map like any other icon in the style's sprite using the image's ID with [`icon-image`](<https://maplibre.org/maplibre-style-spec/layers/#layout-symbol-icon-image>), [`background-pattern`](<https://maplibre.org/maplibre-style-spec/layers/#paint-background-background-pattern>), [`fill-pattern`](<https://maplibre.org/maplibre-style-spec/layers/#paint-fill-fill-pattern>), or [`line-pattern`](<https://maplibre.org/maplibre-style-spec/layers/#paint-line-line-pattern>).

An [ErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) will be fired if the image parameter is invalid.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of the image. |
| `image` | [`StyleImageSource`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageSource/index.md>) | The image as an `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data` properties with the same format as `ImageData`. |

#### Returns

`this`

#### Example

```ts
// If an image with the ID 'cat' already exists in the style's sprite,
// replace that image with a new image, 'other-cat-icon.png'.
if (map.hasImage('cat')) map.updateImage('cat', './other-cat-icon.png');
```

---

### zoomIn()

> **zoomIn**(`options?`: [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1164](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1164>)

Incrementally increases the map's zoom level by 1, first snapping to the nearest `zoomSnap` increment.

Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

Zoom the map in one level with a custom animation duration

```ts
map.zoomIn({duration: 1000});
```

---

### zoomOut()

> **zoomOut**(`options?`: [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1178](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1178>)

Decreases the map's zoom level by 1, first snapping to the nearest `zoomSnap` increment.

Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options?` | [`AnimationOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AnimationOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

Zoom the map out one level with a custom animation offset

```ts
map.zoomOut({offset: [80, 60]});
```

---

### zoomTo()

> **zoomTo**(`zoom`: `number`, `options?`: [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>), `eventData?`: `any`): `this`

Defined in: [ui/map.ts:1150](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L1150>)

Zooms the map to the specified zoom level, with an animated transition.

Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `zoom` | `number` | The zoom level to transition to. |
| `options?` | [`EaseToOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EaseToOptions/index.md>) | Options object |
| `eventData?` | `any` | Additional properties to be added to event objects of events triggered by this method. |

#### Returns

`this`

#### Example

```ts
// Zoom to the zoom level 5 without an animated transition
map.zoomTo(5);
// Zoom to the zoom level 8 with an animated transition
map.zoomTo(8, {
  duration: 2000,
  offset: [100, 50]
});
```

## Properties

### boxZoom

> **boxZoom**: [`BoxZoomHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>)

Defined in: [ui/map.ts:686](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L686>)

The map's [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>), which implements zooming using a drag gesture with the Shift key pressed. Find more details and examples using `boxZoom` in the [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>) section.

---

### cancelPendingTileRequestsWhileZooming

> **cancelPendingTileRequestsWhileZooming**: `boolean`

Defined in: [ui/map.ts:737](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L737>)

The map's property which determines whether to cancel, or retain, tiles from the current viewport which are still loading but which belong to a farther (smaller) zoom level than the current one. \* If `true`, when zooming in, tiles which didn't manage to load for previous zoom levels will become canceled. This might save some computing resources for slower devices, but the map details might appear more abruptly at the end of the zoom. \* If `false`, when zooming in, the previous zoom level(s) tiles will progressively appear, giving a smoother map details experience. However, more tiles will be rendered in a short period of time.

#### Default Value

```ts
true
```

---

### cooperativeGestures

> **cooperativeGestures**: [`CooperativeGesturesHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/CooperativeGesturesHandler/index.md>)

Defined in: [ui/map.ts:729](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L729>)

The map's [CooperativeGesturesHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/CooperativeGesturesHandler/index.md>), which allows the user to see cooperative gesture info when user tries to zoom in/out. Find more details and examples using `cooperativeGestures` in the [CooperativeGesturesHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/CooperativeGesturesHandler/index.md>) section.

---

### doubleClickZoom

> **doubleClickZoom**: [`DoubleClickZoomHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DoubleClickZoomHandler/index.md>)

Defined in: [ui/map.ts:711](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L711>)

The map's [DoubleClickZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DoubleClickZoomHandler/index.md>), which allows the user to zoom by double clicking. Find more details and examples using `doubleClickZoom` in the [DoubleClickZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DoubleClickZoomHandler/index.md>) section.

---

### dragPan

> **dragPan**: [`DragPanHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>)

Defined in: [ui/map.ts:699](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L699>)

The map's [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>), which implements dragging the map with a mouse or touch gesture. Find more details and examples using `dragPan` in the [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>) section.

---

### dragRotate

> **dragRotate**: [`DragRotateHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>)

Defined in: [ui/map.ts:693](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L693>)

The map's [DragRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>), which implements rotating the map while dragging with the right mouse button or with the Control key pressed. Find more details and examples using `dragRotate` in the [DragRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>) section.

---

### keyboard

> **keyboard**: [`KeyboardHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/KeyboardHandler/index.md>)

Defined in: [ui/map.ts:705](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L705>)

The map's [KeyboardHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/KeyboardHandler/index.md>), which allows the user to zoom, rotate, and pan the map using keyboard shortcuts. Find more details and examples using `keyboard` in the [KeyboardHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/KeyboardHandler/index.md>) section.

---

### scrollZoom

> **scrollZoom**: [`ScrollZoomHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/index.md>)

Defined in: [ui/map.ts:680](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L680>)

The map's [ScrollZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/index.md>), which implements zooming in and out with a scroll wheel or trackpad. Find more details and examples using `scrollZoom` in the [ScrollZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/index.md>) section.

---

### touchPitch

> **touchPitch**: [`TwoFingersTouchPitchHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchPitchHandler/index.md>)

Defined in: [ui/map.ts:723](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L723>)

The map's [TwoFingersTouchPitchHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchPitchHandler/index.md>), which allows the user to pitch the map with touch gestures. Find more details and examples using `touchPitch` in the [TwoFingersTouchPitchHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchPitchHandler/index.md>) section.

---

### touchZoomRotate

> **touchZoomRotate**: [`TwoFingersTouchZoomRotateHandler`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/index.md>)

Defined in: [ui/map.ts:717](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/ui/map.ts#L717>)

The map's [TwoFingersTouchZoomRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/index.md>), which allows the user to zoom or rotate the map with touch gestures. Find more details and examples using `touchZoomRotate` in the [TwoFingersTouchZoomRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/index.md>) section.

# GeoJSONSource

Defined in: [source/geojson\_source.ts:165](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L165>)

A source containing GeoJSON. (See the [Style Specification](<https://maplibre.org/maplibre-style-spec/#sources-geojson>) for detailed documentation of options.)

GeoJSON is tiled internally for rendering. Features exposed from rendered tiles and related events come from vector-tile data, so GeoJSON foreign members that cannot be represented by the vector-tile format are not preserved there. Keep that data separately, or map it to supported feature properties, if you need it after tiling.

## Examples

```ts
map.addSource('some id', {
    type: 'geojson',
    data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_ports.geojson'
});
```

```ts
map.addSource('some id', {
   type: 'geojson',
   data: {
       "type": "FeatureCollection",
       "features": [{
           "type": "Feature",
           "properties": {},
           "geometry": {
               "type": "Point",
               "coordinates": [
                   -76.53063297271729,
                   39.18174077994108
               ]
           }
       }]
   }
});
```

```ts
map.getSource('some id').setData({
  "type": "FeatureCollection",
  "features": [{
      "type": "Feature",
      "properties": { "name": "Null Island" },
      "geometry": {
          "type": "Point",
          "coordinates": [ 0, 0 ]
      }
  }]
});
```

## See

- [Draw GeoJSON points](<https://maplibre.org/maplibre-gl-js/docs/examples/draw-geojson-points/>)
- [Add a GeoJSON line](<https://maplibre.org/maplibre-gl-js/docs/examples/add-a-geojson-line/>)
- [Create a heatmap from points](<https://maplibre.org/maplibre-gl-js/docs/examples/create-a-heatmap-layer/>)
- [Create and style clusters](<https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/>)

## Extends

- [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>

## Implements

- [`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>)

## Methods

### abortTile()

> **abortTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/geojson\_source.ts:671](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L671>)

Allows to abort a tile loading.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to abort |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`abortTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#aborttile>)

---

### fire()

#### Call Signature

> **fire**(`event`: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) | [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)): `this`

Defined in: [util/evented.ts:156](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L156>)

Calls every listener registered for the event's type.

##### Parameters

| Parameter | Type |
| --- | --- |
| `event` | [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>) \| [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) |

##### Returns

`this`

##### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#fire>)

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

#### Call Signature

> **fire**(`type`: keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>), `properties?`: `object`): `this`

Defined in: [util/evented.ts:162](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L162>)

Compatibility with the (type: string, properties: Object) signature from previous versions. See https://github.com/mapbox/mapbox-gl-js/issues/6522, https://github.com/mapbox/mapbox-gl-draw/issues/766

##### Parameters

| Parameter | Type |
| --- | --- |
| `type` | keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |
| `properties?` | `object` |

##### Returns

`this`

##### Implementation of

`Source.fire`

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`fire`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#fire>)

---

### getBounds()

> **getBounds**(): `Promise`\<[`LngLatBounds`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>)\>

Defined in: [source/geojson\_source.ts:352](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L352>)

Allows getting the source's boundaries. If there's a problem with the source's data, it will return an empty [LngLatBounds](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>).

#### Returns

`Promise`\<[`LngLatBounds`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>)\>

a promise which resolves to the source's boundaries

---

### getClusterChildren()

> **getClusterChildren**(`clusterId`: `number`): `Promise`\<`Feature`\<`Geometry`, {\[`name`: `string`\]: `any`; }\>\[\]\>

Defined in: [source/geojson\_source.ts:429](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L429>)

For clustered sources, fetches the children of the given cluster on the next zoom level (as an array of GeoJSON features).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `clusterId` | `number` | The value of the cluster's `cluster_id` property. |

#### Returns

`Promise`\<`Feature`\<`Geometry`, {\[`name`: `string`\]: `any`; }\>\[\]\>

a promise that is resolved when the features are retrieved

---

### getClusterExpansionZoom()

> **getClusterExpansionZoom**(`clusterId`: `number`): `Promise`\<`number`\>

Defined in: [source/geojson\_source.ts:419](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L419>)

For clustered sources, fetches the zoom at which the given cluster expands.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `clusterId` | `number` | The value of the cluster's `cluster_id` property. |

#### Returns

`Promise`\<`number`\>

a promise that is resolved with the zoom number

---

### getClusterLeaves()

> **getClusterLeaves**(`clusterId`: `number`, `limit`: `number`, `offset`: `number`): `Promise`\<`Feature`\<`Geometry`, {\[`name`: `string`\]: `any`; }\>\[\]\>

Defined in: [source/geojson\_source.ts:458](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L458>)

For clustered sources, fetches the original points that belong to the cluster (as an array of GeoJSON features).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `clusterId` | `number` | The value of the cluster's `cluster_id` property. |
| `limit` | `number` | The maximum number of features to return. |
| `offset` | `number` | The number of features to skip (e.g. for pagination). |

#### Returns

`Promise`\<`Feature`\<`Geometry`, {\[`name`: `string`\]: `any`; }\>\[\]\>

a promise that is resolved when the features are retrieved

#### Example

Retrieve cluster leaves on click

```ts
map.on('click', 'clusters', (e) => {
  let features = map.queryRenderedFeatures(e.point, {
    layers: ['clusters']
  });

  let clusterId = features[0].properties.cluster_id;
  let pointCount = features[0].properties.point_count;
  let clusterSource = map.getSource('clusters');

  const features = await clusterSource.getClusterLeaves(clusterId, pointCount);
  // Print cluster leaves in the console
  console.log('Cluster leaves:', features);
});
```

---

### getClusterOptions()

> **getClusterOptions**(): [`GetClusterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GetClusterOptions/index.md>)

Defined in: [source/geojson\_source.ts:404](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L404>)

Gets the cluster options currently configured on the source. The returned values mirror the options accepted by `setClusterOptions`.

#### Returns

[`GetClusterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GetClusterOptions/index.md>)

the source's current cluster options

#### Example

```ts
const {cluster, clusterMaxZoom, clusterRadius} = map.getSource('some id').getClusterOptions();
```

---

### getData()

> **getData**(): `Promise`\<`GeoJSON`\<`Geometry`, {\[`name`: `string`\]: `any`; }\>\>

Defined in: [source/geojson\_source.ts:334](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L334>)

Allows to get the source's actual GeoJSON data.

Data set as a URL is returned once it has loaded.

#### Returns

`Promise`\<`GeoJSON`\<`Geometry`, {\[`name`: `string`\]: `any`; }\>\>

a promise which resolves to the source's actual GeoJSON data

---

### hasTransition()

> **hasTransition**(): `boolean`

Defined in: [source/geojson\_source.ts:706](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L706>)

True if the source has transition, false otherwise.

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`hasTransition`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#hastransition>)

---

### listens()

> **listens**(`type`: keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)): `boolean`

Defined in: [util/evented.ts:206](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L206>)

Returns a true if this instance of Evented or any forwardeed instances of Evented have a listener for the specified type.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) | The event type |

#### Returns

`boolean`

`true` if there is at least one registered listener for specified event type, `false` otherwise

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`listens`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#listens>)

---

### loaded()

> **loaded**(): `boolean`

Defined in: [source/geojson\_source.ts:632](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L632>)

True if the source is loaded, false otherwise.

#### Returns

`boolean`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`loaded`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#loaded>)

---

### loadTile()

> **loadTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/geojson\_source.ts:636](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L636>)

This method does the heavy lifting of loading a tile. In most cases it will defer the work to the relevant worker source.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to load |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`loadTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#loadtile>)

---

### off()

> **off**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:117](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L117>)

Removes a previously registered event listener.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to remove listeners for. |
| `listener` | (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void` | The listener function to remove. |

#### Returns

`this`

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`off`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#off>)

---

### on()

> **on**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void`): [`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

Defined in: [util/evented.ts:100](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L100>)

Adds a listener to a specified event type.

#### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to add a listen for. |
| `listener` | (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired. The listener function is called with the data object passed to `fire`, extended with `target` and `type` properties. |

#### Returns

[`Subscription`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Subscription/index.md>)

#### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`on`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#on>)

---

### onAdd()

> **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `void`

Defined in: [source/geojson\_source.ts:287](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L287>)

This method is called when the source is added to the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The map instance |

#### Returns

`void`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`onAdd`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#onadd>)

---

### once()

#### Call Signature

> **once**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`): `Promise`\<[`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]\>

Defined in: [util/evented.ts:132](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L132>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |

##### Returns

`Promise`\<[`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]\>

a promise that resolves with the event

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

#### Call Signature

> **once**\<`T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\>(`type`: `T`, `listener`: (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void`): `this`

Defined in: [util/evented.ts:142](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L142>)

Adds a listener that will be called only once to a specified event type.

The listener will be called first time the event fires after the listener is registered.

##### Type Parameters

| Type Parameter |
| --- |
| `T` *extends* keyof [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>) |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `type` | `T` | The event type to listen for. |
| `listener` | (`event`: [`SourceEventType`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)\[`T`\]) =\> `void` | The function to be called when the event is fired the first time. |

##### Returns

`this`

`this` when a listener is provided

##### Inherited from

[`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>).[`once`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/#once>)

---

### onRemove()

> **onRemove**(): `void`

Defined in: [source/geojson\_source.ts:688](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L688>)

Drops the worker updates waiting to be sent, which would otherwise rebuild the worker's state for a source that is gone. The update being sent ends in a `dataabort` event.

#### Returns

`void`

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`onRemove`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#onremove>)

---

### serialize()

> **serialize**(): `GeoJSONSourceSpecification`

Defined in: [source/geojson\_source.ts:694](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L694>)

#### Returns

`GeoJSONSourceSpecification`

A plain (stringifiable) JS object representing the current state of the source. Creating a source using the returned object as the `options` should result in a Source that is equivalent to this one.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`serialize`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#serialize>)

---

### setClusterOptions()

> **setClusterOptions**(`options`: [`SetClusterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SetClusterOptions/index.md>)): `Promise`\<`void`\>

Defined in: [source/geojson\_source.ts:365](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L365>)

To disable/enable clustering on the source options

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | [`SetClusterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SetClusterOptions/index.md>) | The options to set |

#### Returns

`Promise`\<`void`\>

#### Example

```ts
map.getSource('some id').setClusterOptions({cluster: false});
map.getSource('some id').setClusterOptions({cluster: false, clusterRadius: 50, clusterMaxZoom: 14});
```

---

### setData()

> **setData**(`data`: `string` | `GeoJSON`\<`Geometry`, {\[`name`: `string`\]: `any`; }\>): `Promise`\<`void`\>

Defined in: [source/geojson\_source.ts:297](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L297>)

Sets the GeoJSON data and re-renders the map.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `data` | `string` \| `GeoJSON`\<`Geometry`, {\[`name`: `string`\]: `any`; }\> | A GeoJSON data object or a URL to one. The latter is preferable in the case of large GeoJSON files. |

#### Returns

`Promise`\<`void`\>

---

### setEventedParent()

> **setEventedParent**(`parent?`: [`Evented`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)\<[`EventTypeMap`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventTypeMap/index.md>)\>, `data?`: [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>) | (() =\> [`EventedParentData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/EventedParentData/index.md>))): `this`

Defined in: [util/evented.ts:217](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/evented.ts#L217>)

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

### unloadTile()

> **unloadTile**(`tile`: [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>)): `Promise`\<`void`\>

Defined in: [source/geojson\_source.ts:679](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L679>)

Allows to unload a tile.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `tile` | [`Tile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Tile/index.md>) | The tile to unload |

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`unloadTile`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#unloadtile>)

---

### updateData()

> **updateData**(`diff`: [`GeoJSONSourceDiff`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeoJSONSourceDiff/index.md>)): `Promise`\<`void`\>

Defined in: [source/geojson\_source.ts:317](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L317>)

Updates the source's GeoJSON, and re-renders the map.

For sources with lots of features, this method can be used to make updates more quickly.

This approach requires unique IDs for every feature in the source. The IDs can either be specified on the feature, or by using the promoteId option to specify which property should be used as the ID.

It is an error to call updateData on a source that did not have unique IDs for each of its features already.

Updates are applied on a best-effort basis, updating an ID that does not exist will not result in an error.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `diff` | [`GeoJSONSourceDiff`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeoJSONSourceDiff/index.md>) | The changes that need to be applied. |

#### Returns

`Promise`\<`void`\>

## Properties

### attribution

> **attribution**: `string`

Defined in: [source/geojson\_source.ts:171](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L171>)

The attribution for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`attribution`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#attribution>)

---

### id

> **id**: `string`

Defined in: [source/geojson\_source.ts:167](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L167>)

The id for the source. Must not be used by any existing source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`id`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#id>)

---

### isTileClipped

> **isTileClipped**: `boolean`

Defined in: [source/geojson\_source.ts:174](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L174>)

`false` if tiles can be drawn outside their boundaries, `true` if they cannot.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`isTileClipped`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#istileclipped>)

---

### maxzoom

> **maxzoom**: `number`

Defined in: [source/geojson\_source.ts:169](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L169>)

The maximum zoom level for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`maxzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#maxzoom>)

---

### minzoom

> **minzoom**: `number`

Defined in: [source/geojson\_source.ts:168](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L168>)

The minimum zoom level for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`minzoom`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#minzoom>)

---

### reparseOverscaled

> **reparseOverscaled**: `boolean`

Defined in: [source/geojson\_source.ts:175](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L175>)

`true` if tiles should be sent back to the worker for each overzoomed zoom level, `false` if not.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`reparseOverscaled`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#reparseoverscaled>)

---

### tileSize

> **tileSize**: `number`

Defined in: [source/geojson\_source.ts:170](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/source/geojson_source.ts#L170>)

The tile size for the source.

#### Implementation of

[`Source`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>).[`tileSize`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/#tilesize>)

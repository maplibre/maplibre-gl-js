# Optimising MapLibre Performance: Tips for Large GeoJSON Datasets

Performance is a critical aspect of providing users with a smooth and responsive experience. This guide focuses on techniques for improving the performance of MapLibre, particularly when dealing with large datasets in GeoJSON format. We'll categorise our strategies into two key areas:

1. Loading the data
1. Visualizing the data

## Loading the Data

### Making the File Smaller

When working with large GeoJSON datasets, one of the most effective ways to enhance loading performance is to reduce the data's size. You can implement the following approaches with packages such as [Turf](https://turfjs.org/) or web tools such as [Reduce GeoJSON](https://reducegeojson.radicaldata.org/) and [Mapshaper](https://github.com/mbloch/mapshaper).

#### Removing unused properties

GeoJSON files often contain numerous properties that are not essential for your map's functionality. By eliminating any unused or redundant properties, you can significantly reduce the file size, leading to faster loading times.

#### Reduce precision of coordinates

GeoJSON coordinates typically default to extreme precision, often with 15-17 decimal places, which is on an atomic scale. For most practical applications, you can reduce the coordinate precision to around 6 decimals, roughly equivalent to a [scale of around 1cm](https://en.wikipedia.org/wiki/Decimal_degrees#Precision). This reduces the file size without compromising usability.

#### Simplify geometry

If your GeoJSON contains geometries (not just points), consider using various algorithms to simplify the geometry. Tools like [Mapshaper](https://github.com/mbloch/mapshaper) provide user-friendly interfaces for this task.

#### Minify

Minifying the GeoJSON data by removing unnecessary whitespace can further decrease the file size, aiding in quicker data transmission.

#### Data Compression

Another approach is to compress the GeoJSON data and send the zipped file to the user's browser. While this introduces a minor tradeoff between processing and file size, it's generally acceptable, considering the efficiency of modern JavaScript.

### Data Chunking

If your GeoJSON dataset is still quite large after reducing its size, consider splitting it into smaller, manageable chunks. Even 2 or 3 can be beneficial. These split datasets can be added to the map as normal with `addSource()` and `addLayer()`.

This technique can be particularly useful when there are parts of the dataset that have different properties. For example, if the map starts zoomed into an geographic area, the data within this geography could be one chunk and the rest could be another chunk. Similarly, if one part of the dataset has live updates and the rest is largely static, it could make sense to place these two parts into separate chunks.

Data chunking is more impactful on desktop browsers than mobile browsers.

### Data Streaming

Implementing data streaming techniques can further enhance loading performance. Rather than loading the entire dataset at once, data streaming allows you to load smaller portions as the user interacts with the map. This approach minimises the initial loading time and provides a more responsive experience. A template for data streaming can be found in the [Live Update Features](https://maplibre.org/maplibre-gl-js/docs/examples/live-update-feature/) example.

### Store GeoJSON at URL

For improved performance in MapLibre, it's advisable to load your GeoJSON data from a data URL rather than embedding it directly in your JavaScript code. This practice helps reduce the memory overhead on the client-side.

### Vector Tiling

Consider converting your GeoJSON data into vector tiles, which are specifically designed for efficient rendering. An example is available on how to [add a vector tile source](https://maplibre.org/maplibre-gl-js/docs/examples/vector-source/).

### Tiling on the server

For even larger datasets you can use a tool like [Martin](https://maplibre.org/martin/) to turn a database into tiles on the server side. These tiles can then be shown directly to the user. A [demo of Martin](https://martin.maplibre.org/) shows it comfortably handling a 13GB database. However, this approach will require more setup than the others.

## Visualising the Data

Once the data is loaded, to ensure a smooth user experience, it's essential to optimise how you visualise the data on the map.

### Cluster

One simple approach is to visualise fewer points. If we are using a GeoJSON source (i.e. not vector tiles), we can use 'clustering' to group nearby points together. This approach reduces the number of features displayed on the map, improving rendering performance and maintaining map readability.

To do this, when we add the data, we can adjust the [cluster options](../API/type-aliases/SetClusterOptions.md). For example:

```javascript
map.addSource('earthquakes', {
            type: 'geojson',
            data: 'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson',
            cluster: true,
            clusterMaxZoom: 14, // Max zoom to cluster points on
            clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
        });
```

You can see a full example here: [Create and style clusters](https://maplibre.org/maplibre-gl-js/docs/examples/cluster/).

### Allow Overlap

By default, Maplibre calculates if features such as points, texts or icons are overlapping. This can be computationally intensive, particularly when there are a lot of features. Changing the [overlap mode](https://maplibre.org/maplibre-style-spec/layers/#layout-symbol-icon-allow-overlap) so that all points are shown and no overlapping is checked can significantly reduce this.

### Simplify Styling

Complex and intricate map styles can slow down rendering, especially when working with large datasets. Simplify your map styles by reducing the number of layers, symbols, and complex features, and use simpler symbology where appropriate.

### Zoom Levels

Optimising your zoom levels ensures that the map loads efficiently and displays the right level of detail at different zoom levels, contributing to a smoother user experience.

#### Max Zoom Level

To improve map performance during panning and zooming, set the maxZoom option on your GeoJSON source to a value lower than the default 22. For most point sources, a maxZoom value of 12 strikes a good balance between precision and speed.

#### Min Zoom Level

Adjust the minZoom property on the layer that references the GeoJSON source to a value greater than 0. This setting prevents the map from attempting to load and render tiles at low zoom levels, which is often unnecessary because there aren't enough screen pixels to display every feature of a large dataset. By adjusting the minZoom property, you'll achieve a faster map load and improved rendering performance.

You can implement them both as follows:

```javascript
let map = new maplibregl.Map({
  container: 'map',
  maxZoom: 12,
  minZoom: 5
});
```

import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';
import workerUrl from 'maplibre-gl/worker?url';

// Vite does not extend `new URL(..., import.meta.url)` asset-detection to
// files inside `node_modules`, so the auto-detection inside `maplibre-gl.mjs`
// can't find the worker file. The `?url` query is Vite's idiomatic way to
// import a file purely for its URL.
setWorkerUrl(workerUrl);

new Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [0, 0],
    zoom: 1
});

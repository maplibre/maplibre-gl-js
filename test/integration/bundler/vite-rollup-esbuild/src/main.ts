import {Map, setWorkerFactory} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Worker from 'maplibre-gl/dist/maplibre-gl-worker.mjs';

setWorkerFactory(() => new Worker());

new Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [0, 0],
    zoom: 1
});

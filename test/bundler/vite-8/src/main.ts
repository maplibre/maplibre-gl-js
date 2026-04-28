import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';
import workerUrl from 'maplibre-gl/worker?url';

setWorkerUrl(workerUrl);

new Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [0, 0],
    zoom: 1
});

import {Map, setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/css';

setWorkerUrl(new URL('maplibre-gl/worker', import.meta.url).toString());

new Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [0, 0],
    zoom: 1
});

import {Map} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

new Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [0, 0],
    zoom: 1
});

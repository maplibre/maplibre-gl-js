
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

const width = 1024;
const height = 768;

export default class TerrainRender extends Benchmark {

    map: any;

    async setup() {
        try {
            this.map = await createMap({
                zoom: 12,
                width,
                height,
                center: [10.5, 46.9],
                pitch: 60,
                style: {
                    version: 8,
                    sources: {
                        'openmaptiles': {
                            'type': 'vector',
                            'url': 'https://api.maptiler.com/tiles/v3/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
                        },
                        'terrain-rgb': {
                            'type': 'raster-dem',
                            'url': 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
                        }
                    },
                    terrain: {
                        source: 'terrain-rgb',
                        exaggeration: 1
                    },
                    layers: [
                        {
                            'id': 'background',
                            'type': 'background',
                            'paint': {'background-color': '#f8f4f0'}
                        },
                        {
                            'id': 'water',
                            'type': 'fill',
                            'source': 'openmaptiles',
                            'source-layer': 'water',
                            'paint': {'fill-color': '#a0c8f0'}
                        },
                        {
                            'id': 'roads',
                            'type': 'line',
                            'source': 'openmaptiles',
                            'source-layer': 'transportation',
                            'paint': {'line-color': '#ffffff', 'line-width': 1}
                        },
                        {
                            'id': 'labels',
                            'type': 'symbol',
                            'source': 'openmaptiles',
                            'source-layer': 'place',
                            'layout': {'text-field': '{name}', 'text-size': 12}
                        }
                    ]
                },
                idle: true
            });
        } catch (error) {
            console.error(error);
        }
    }

    bench() {
        Benchmark.renderMap(this.map);
    }

    teardown() {
        this.map.remove();
    }
}

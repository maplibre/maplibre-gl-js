
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

export default class TerrainRender extends Benchmark {

    map: any;

    async setup() {
        try {
            this.map = await createMap({
                zoom: 12,
                width: 1024,
                height: 768,
                center: [10.5, 46.9],
                pitch: 60,
                style: {
                    version: 8,
                    sources: {
                        'terrain-rgb': {
                            'type': 'raster-dem',
                            'url': 'https://tiles.mapterhorn.com/tilejson.json'
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

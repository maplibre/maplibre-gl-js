import Benchmark from '../lib/benchmark.ts';
import createMap from '../lib/create_map.ts';
import style from '../data/empty.json' with {type: 'json'};

export default class LineOpacityTranslucent extends Benchmark {
    map: any;

    async setup(): Promise<void> {
        const layers = [];
        for (let i = 0; i < 50; i++) {
            layers.push({
                id: `linelayer${i}`,
                type: 'line',
                source: 'openmaptiles',
                'source-layer': 'transportation',
                paint: {'line-opacity': 0.5},
            });
        }
        this.map = await createMap({
            zoom: 16,
            width: 1024,
            height: 768,
            center: [-77.032194, 38.912753],
            style: {...style, layers},
        });
    }

    bench(): void { Benchmark.renderMap(this.map); }
    teardown(): void { this.map.remove(); }
}
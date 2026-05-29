import Benchmark from '../lib/benchmark.ts';
import createMap from '../lib/create_map.ts';
import style from '../data/empty.json' with {type: 'json'};

const width = 1024;
const height = 768;
const layerCount = 50;

export default class LayerLineFilteredOpacity extends Benchmark {
    map: any;
    numFeatures: number;

    async setup(): Promise<void> {
        const layers = [];
        for (let i = 0; i < layerCount; i++) {
            layers.push({
                id: `linelayer${i}`,
                type: 'line',
                source: 'openmaptiles',
                'source-layer': 'transportation',
                paint: {
                    'line-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'visible'], false],
                        1,
                        0
                    ]
                }
            });
        }

        this.map = await createMap({
            zoom: 16,
            width,
            height,
            center: [-77.032194, 38.912753],
            style: {
                ...style,
                sources: {
                    ...style.sources,
                    openmaptiles: {
                        ...((style as any).sources?.openmaptiles || {}),
                        promoteId: 'id'
                    }
                },
                layers
            },
        });

        // Render once so tiles are loaded
        Benchmark.renderMap(this.map);

        // Set 1/10 of features visible via feature state
        const sourceFeatures = this.map.querySourceFeatures('openmaptiles', {sourceLayer: 'transportation'});
        this.numFeatures = sourceFeatures.length;
        for (let i = 0; i < sourceFeatures.length; i++) {
            if (i % 10 === 0) {
                this.map.setFeatureState(
                    {source: 'openmaptiles', sourceLayer: 'transportation', id: sourceFeatures[i].id},
                    {visible: true}
                );
            }
        }
    }

    bench(): void {
        Benchmark.renderMap(this.map);
    }

    teardown(): void {
        this.map.remove();
    }
}

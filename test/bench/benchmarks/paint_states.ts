
import emptystyle from '../data/empty.json' with {type: 'json'};
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Map} from '../../../src/ui/map';

function generateLayers(layer: LayerSpecification): LayerSpecification[] {
    const generated = [];
    for (let i = 0; i < 50; i++) {
        const id = layer.id + i;
        generated.push(Object.assign({}, layer, {id}));
    }
    return generated;
}

const width = 1024;
const height = 768;
const zoom = 4;

export default class PaintStates extends Benchmark {

    center: [number, number];
    numFeatures: number;
    map: Map;

    constructor(center: [number, number]) {
        super();
        this.center = center;
    }

    async setup() {
        const response = await fetch('/test/bench/data/naturalearth-land.json');
        const data = await response.json();
        this.numFeatures = data.features.length;
        const style = Object.assign({}, emptystyle, {
            sources: {'land': {'type': 'geojson', data, 'maxzoom': 23}},
            layers: generateLayers({
                'id': 'layer',
                'type': 'fill',
                'source': 'land',
                'paint': {
                    'fill-color': [
                        'case',
                        ['boolean', ['feature-state', 'bench'], false],
                        ['rgb', 21, 210, 210],
                        ['rgb', 233, 233, 233]
                    ]
                }
            })
        });
        try {
            this.map = await createMap({
                zoom,
                width,
                height,
                center: this.center,
                style
            });
        } catch (error) {
            console.error(error);
        }
    }

    bench() {
        this.map._styleDirty = true;
        this.map._sourcesDirty = true;
        this.map._render(undefined);
        for (let i = 0; i < this.numFeatures; i += 50) {
            this.map.setFeatureState({source: 'land', id: i}, {bench: true});
        }
        this.map._render(undefined);
    }

    teardown() {
        this.map.remove();
    }
}

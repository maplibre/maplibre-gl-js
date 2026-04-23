import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import style from '../data/empty.json' with {type: 'json'};
import type {Map} from '../../../src/ui/map';

// Measures the cost of rendering line layers with non-constant opacity.
//
// PR #7490 introduces an offscreen pass for line layers whose `line-opacity`
// is constant > 0 and < 1, to fix artifacts from overlapping translucent
// strokes. The offscreen pass adds an FBO allocation, an extra render
// target switch, and a full-viewport composite per affected layer, so this
// benchmark exists to quantify that cost.
//
// Three variants render the same OpenMapTiles `transportation` source with
// many duplicated line layers (so per-layer overhead dominates):
//   - LineOpacityOpaque:      opacity = 1   (no offscreen pass)
//   - LineOpacityTranslucent: opacity = 0.5 (triggers offscreen pass)
//   - LineOpacityDataDriven:  opacity = data-driven (no offscreen pass; data-driven opacity skips the optimization)
//
// Comparing Opaque vs Translucent isolates the offscreen-pass cost.

const width = 1024;
const height = 768;
const layerCount = 50;

class LineOpacityBenchmark extends Benchmark {
    layerStyle: any;
    map: Map;

    constructor(opacity: number | unknown[]) {
        super();
        const layers = [];
        for (let i = 0; i < layerCount; i++) {
            layers.push({
                'id': `linelayer${i}`,
                'type': 'line',
                'source': 'openmaptiles',
                'source-layer': 'transportation',
                'paint': {
                    'line-opacity': opacity,
                },
            });
        }
        this.layerStyle = {...style, layers};
    }

    async setup() {
        this.map = await createMap({
            zoom: 16,
            width,
            height,
            center: [-77.032194, 38.912753],
            style: this.layerStyle,
        });
    }

    bench() {
        Benchmark.renderMap(this.map);
    }

    teardown() {
        this.map.remove();
    }
}

export class LineOpacityOpaque extends LineOpacityBenchmark {
    constructor() {
        super(1);
    }
}

export class LineOpacityTranslucent extends LineOpacityBenchmark {
    constructor() {
        super(0.5);
    }
}

export class LineOpacityDataDriven extends LineOpacityBenchmark {
    constructor() {
        // Data-driven opacity is not a constant, so `hasOffscreenPass()` returns false.
        // Included as a control: same blending math, no FBO machinery.
        super(['case', ['==', ['get', 'class'], 'motorway'], 0.5, 0.5]);
    }
}

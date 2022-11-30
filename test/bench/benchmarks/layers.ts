
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import style from '../data/empty.json' assert {type: 'json'};

const width = 1024;
const height = 768;
const layerCount = 50;

function generateLayers(layer) {
    const generated = [];
    for (let i = 0; i < layerCount; i++) {
        const id = layer.id + i;
        generated.push(Object.assign({}, layer, {id}));
    }
    return generated;
}

export class LayerBenchmark extends Benchmark {

    layerStyle: any;
    map: any;

    async setup() {
        try {
            this.map = await createMap({
                zoom: 16,
                width,
                height,
                center: [-77.032194, 38.912753],
                style: this.layerStyle
            });
        } catch (error) {
            console.error(error);
        }
    }

    bench() {
        this.map._render();
    }

    teardown() {
        this.map.remove();
    }
}

export class LayerBackground extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                id: 'backgroundlayer',
                type: 'background'
            })
        });
    }
}

export class LayerCircle extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'circlelayer',
                'type': 'circle',
                'source': 'openmaptiles',
                'source-layer': 'poi'
            })
        });
    }
}

export class LayerFill extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'filllayer',
                'type': 'fill',
                'source': 'openmaptiles',
                'source-layer': 'building',
                'paint': {
                    'fill-color': 'black',
                    'fill-outline-color': 'red'
                }
            })
        });
    }
}

export class LayerFillExtrusion extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'fillextrusionlayer',
                'type': 'fill-extrusion',
                'source': 'openmaptiles',
                'source-layer': 'building',
                'paint': {
                    'fill-extrusion-height': 30
                }
            })
        });
    }
}

export class LayerHeatmap extends LayerBenchmark {
    async setup() {
        const response = await fetch('/bench/data/naturalearth-land.json');
        const data = await response.json();
        this.layerStyle = Object.assign({}, style, {
            sources: {
                'heatmap': {
                    'type': 'geojson',
                    data,
                    'maxzoom': 23
                }
            },
            layers: generateLayers({
                'id': 'layer',
                'type': 'heatmap',
                'source': 'heatmap',
                'paint': {
                    'heatmap-radius': 50,
                    'heatmap-weight': {
                        'stops': [[0, 0.5], [4, 2]]
                    },
                    'heatmap-intensity': 0.9,
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(0, 0, 255, 0)',
                        0.1, 'royalblue',
                        0.3, 'cyan',
                        0.5, 'lime',
                        0.7, 'yellow',
                        1, 'red'
                    ]
                }
            })
        });
        await super.setup();
    }
}

export class LayerHillshade extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            sources: {
                'terrain-rgb': {
                    'type': 'raster-dem',
                    'url': 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
                }
            },
            layers: generateLayers({
                'id': 'layer',
                'type': 'hillshade',
                'source': 'terrain-rgb',
            })
        });
    }
}

export class LayerLine extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'linelayer',
                'type': 'line',
                'source': 'openmaptiles',
                'source-layer': 'transportation'
            })
        });
    }
}

export class LayerRaster extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            sources: {
                'satellite': {
                    'url': 'https://api.maptiler.com/tiles/satellite/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
                    'type': 'raster',
                    'tileSize': 256
                }
            },
            layers: generateLayers({
                'id': 'rasterlayer',
                'type': 'raster',
                'source': 'satellite'
            })
        });
    }
}

export class LayerSymbol extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'symbollayer',
                'type': 'symbol',
                'source': 'openmaptiles',
                'source-layer': 'poi',
                'layout': {
                    'icon-image': 'dot_11',
                    'text-field': '{name_en}'
                }
            })
        });
    }
}

export class LayerSymbolWithIcons extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'symbollayer',
                'type': 'symbol',
                'source': 'openmaptiles',
                'source-layer': 'poi',
                'layout': {
                    'icon-image': 'dot_11',
                    'text-field': ['format', ['get', 'name_en'], ['image', 'dot_11']]
                }
            })
        });
    }
}

export class LayerSymbolWithSortKey extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: this.generateSortKeyLayers()
        });
    }

    generateSortKeyLayers() {
        const generated = [];
        for (let i = 0; i < layerCount; i++) {
            generated.push({
                'id': `symbollayer${i}`,
                'type': 'symbol',
                'source': 'openmaptiles',
                'source-layer': 'poi',
                'layout': {
                    'symbol-sort-key': i,
                    'text-field': '{name_en}'
                }
            });
        }
        return generated;
    }
}

export class LayerTextWithVariableAnchor extends LayerBenchmark {
    constructor() {
        super();

        this.layerStyle = Object.assign({}, style, {
            layers: generateLayers({
                'id': 'symbollayer',
                'type': 'symbol',
                'source': 'openmaptiles',
                'source-layer': 'poi',
                'layout': {
                    'text-field': 'Test Test Test',
                    'text-justify': 'auto',
                    'text-variable-anchor': [
                        'center',
                        'top',
                        'bottom',
                        'left',
                        'right',
                        'top-left',
                        'top-right',
                        'bottom-left',
                        'bottom-right'
                    ]
                }
            })
        });
    }
}

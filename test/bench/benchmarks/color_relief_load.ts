import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * Measures how long it takes the map to reach the idle state when only using color-relief tiles.
 */
export default class ColorReliefLoad extends Benchmark {
    style: StyleSpecification;

    constructor() {
        super();

        // This is a longer running test and the duration will vary by device and network.
        // To keep the test time more reasonable, lower the minimum number of measurements.
        // 55 measurements => 10 observations for regression.
        this.minimumMeasurements = 55;

        this.style = {
            'version': 8,
            'name': 'Color-relief-only',
            'center': [-112.81596278901452, 37.251160384573595],
            'zoom': 11.560975632435424,
            'bearing': 0,
            'pitch': 0,
            'sources': {
                'terrain-rgb': {
                    'url': 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
                    'type': 'raster-dem',
                    'tileSize': 256
                }
            },
            'layers': [
                {
                    'id': 'maplibre-terrain-rgb',
                    'type': 'color-relief',
                    'source': 'terrain-rgb',
                    'layout': {},
                    'paint': {
                        'color-relief-color': [
                            "interpolate",
                            ["linear"],
                            ["elevation"],
                            0, 'rgb(112, 209, 255)',
                            12.88581315, 'rgb(113, 211, 247)',
                            51.5432526, 'rgb(114, 212, 234)',
                            115.9723183, 'rgb(117, 213, 222)',
                            206.1730104, 'rgb(120, 214, 209)',
                            322.1453287, 'rgb(124, 215, 196)',
                            463.8892734, 'rgb(130, 215, 183)',
                            631.4048443, 'rgb(138, 215, 169)',
                            824.6920415, 'rgb(149, 214, 155)',
                            1043.750865, 'rgb(163, 212, 143)',
                            1288.581315, 'rgb(178, 209, 134)',
                            1559.183391, 'rgb(193, 205, 127)',
                            1855.557093, 'rgb(207, 202, 121)',
                            2177.702422, 'rgb(220, 197, 118)',
                            2525.619377, 'rgb(233, 193, 118)',
                            2899.307958, 'rgb(244, 188, 120)',
                            3298.768166, 'rgb(255, 183, 124)',
                            3724, 'rgb(255, 178, 129)'
                        ]
                    }
                }
            ]
        };
    }

    async bench() {
        const map = await createMap({
            width: 1024,
            height: 1024,
            style: this.style,
            stubRender: false,
            showMap: true,
            idle: true
        });
        map.remove();
    }
}

import Benchmark from '../lib/benchmark.ts';
import createMap from '../lib/create_map.ts';

const width = 1024;
const height = 768;
const zoom = 14;
const featureCount = 10000;
const layerCount = 20;

const viewportDegreesW = 360 * (width / 256) / Math.pow(2, zoom);
const viewportDegreesH = 360 * (height / 256) / Math.pow(2, zoom);

function generateSquaresGeoJSON(center: [number, number], count: number): GeoJSON.FeatureCollection {
    const [cx, cy] = center;
    const features: GeoJSON.Feature[] = [];
    const squareSize = viewportDegreesW * (50 / width);

    // Seeded random for reproducibility
    let seed = 12345;
    function random() {
        seed = (seed * 16807 + 0) % 2147483647;
        return seed / 2147483647;
    }

    for (let i = 0; i < count; i++) {
        const x = cx + (random() - 0.5) * viewportDegreesW;
        const y = cy + (random() - 0.5) * viewportDegreesH;
        features.push({
            type: 'Feature',
            id: i,
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [x, y],
                    [x + squareSize, y],
                    [x + squareSize, y + squareSize],
                    [x, y + squareSize],
                    [x, y]
                ]]
            }
        });
    }
    return {type: 'FeatureCollection', features};
}

export default class LayerLineFilteredOpacity extends Benchmark {
    map: any;

    async setup(): Promise<void> {
        const center: [number, number] = [-77.032194, 38.912753];
        const data = generateSquaresGeoJSON(center, featureCount);

        const layers: any[] = [];
        for (let i = 0; i < layerCount; i++) {
            layers.push({
                id: `squares-line-${i}`,
                type: 'line',
                source: 'squares',
                paint: {
                    'line-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'visible'], false],
                        1,
                        0
                    ],
                    'line-color': '#ff0000',
                    'line-width': 2
                }
            });
        }

        this.map = await createMap({
            zoom,
            width,
            height,
            center,
            style: {
                version: 8,
                sources: {
                    'squares': {
                        type: 'geojson',
                        data
                    }
                },
                layers
            },
        });

        // Render once so data is loaded
        Benchmark.renderMap(this.map);

        // Only 1/20 of features visible — 95% are culled
        for (let i = 0; i < featureCount; i += 20) {
            this.map.setFeatureState(
                {source: 'squares', id: i},
                {visible: true}
            );
        }
    }

    bench(): void {
        Benchmark.renderMap(this.map);
    }

    teardown(): void {
        this.map.remove();
    }
}

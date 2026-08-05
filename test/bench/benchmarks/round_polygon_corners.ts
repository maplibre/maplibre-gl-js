import Benchmark from '../lib/benchmark.ts';
import createMap from '../lib/create_map.ts';
import type {Map} from '../../../src/ui/map.ts';
import type {GeoJSONSource} from '../../../src/source/geojson_source.ts';

function generateBuildingData(): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];

    for (let i = 0; i < 500; i++) {
        const cx = -74.006 + (i % 25) * 0.002;
        const cy = 40.7128 + Math.floor(i / 25) * 0.002;
        const size = 0.0008;

        const outerRing = [
            [cx - size, cy - size],
            [cx + size, cy - size],
            [cx + size, cy + size],
            [cx - size, cy + size],
            [cx - size, cy - size]
        ];

        const holeRing = [
            [cx - size * 0.4, cy - size * 0.4],
            [cx + size * 0.4, cy - size * 0.4],
            [cx + size * 0.4, cy + size * 0.4],
            [cx - size * 0.4, cy + size * 0.4],
            [cx - size * 0.4, cy - size * 0.4]
        ];

        features.push({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: i % 2 === 0 ? [outerRing, holeRing] : [outerRing]
            }
        });
    }

    return {
        type: 'FeatureCollection',
        features
    };
}

export default class RoundPolygonCorners extends Benchmark {
    map: Map;
    sampleData: GeoJSON.FeatureCollection;

    async setup(): Promise<void> {
        this.sampleData = generateBuildingData();

        this.map = await createMap({
            width: 512,
            height: 512,
            center: [-74.006, 40.7128],
            zoom: 15,
            fadeDuration: 0,
            style: {
                version: 8,
                sources: {
                    buildings: {
                        type: 'geojson',
                        data: {
                            type: 'FeatureCollection',
                            features: []
                        }
                    }
                },
                layers: [
                    {
                        id: 'building-extrusion',
                        type: 'fill-extrusion',
                        source: 'buildings',
                        layout: {
                            'fill-extrusion-rounded-corner-distance': 15
                        },
                        paint: {
                            'fill-extrusion-color': '#007cbf',
                            'fill-extrusion-height': 15
                        }
                    }
                ]
            }
        });

        if (!this.map.loaded()) {
            await this.map.once('idle');
        }
    }

    async bench(): Promise<void> {
        const source = this.map.getSource<GeoJSONSource>('buildings');
        source.setData(this.sampleData);
        await this.map.once('idle');
    }

    teardown(): void {
        this.map.remove();
    }
}

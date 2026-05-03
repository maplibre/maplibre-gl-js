import Benchmark from '../lib/benchmark.ts';
import createMap from '../lib/create_map.ts';
import type {Map} from '../../../src/ui/map.ts';
import type {GeoJSONSource} from '../../../src/source/geojson_source.ts';

const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: new Array(100_000).fill(0).map(() => ({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Point',
            coordinates: [
                Math.random() * 360 - 180,
                Math.random() * 180 - 90
            ],
        }
    }))
};

export default class GeoJSONSourceSetData extends Benchmark {
    map: Map;

    async setup(): Promise<void> {
        this.map = await createMap({
            width: 512,
            height: 512,
            center: [0, 0],
            zoom: 1,
            fadeDuration: 0,
            style: {
                version: 8,
                sources: {
                    points: {
                        type: 'geojson',
                        data
                    }
                },
                layers: [{
                    id: 'points',
                    type: 'circle',
                    source: 'points',
                    paint: {
                        'circle-radius': 4,
                        'circle-color': '#007cbf'
                    }
                }]
            }
        });

        await new Promise(resolve => {
            if (this.map.loaded()) {
                resolve(null);
            } else {
                this.map.once('idle', resolve);
            }
        });
    }

    async bench(): Promise<void> {
        const source = this.map.getSource<GeoJSONSource>('points');

        source.setData(data);

        await new Promise(resolve => {
            this.map.once('idle', resolve);
        });
    }

    teardown(): void {
        this.map.remove();
    }
}

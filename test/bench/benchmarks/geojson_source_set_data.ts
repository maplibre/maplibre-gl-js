import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import type {Map} from '../../../src/ui/map';
import type {GeoJSONSource} from '../../../src/source/geojson_source';

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
}

export default class GeoJSONSourceSetData extends Benchmark {
    map: Map;

    async setup() {
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

    async bench() {
        const source = this.map.getSource('points') as GeoJSONSource;

        source.setData(data);

        await new Promise(resolve => {
            this.map.once('idle', resolve);
        });
    }

    teardown() {
        this.map.remove();
    }
}

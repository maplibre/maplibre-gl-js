import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import type {Map} from '../../../src/ui/map';
import type {GeoJSONSource} from '../../../src/source/geojson_source';

export default class GeoJSONSourceUpdateData extends Benchmark {
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
                        data: {
                            type: 'FeatureCollection',
                            features: new Array(100_000).fill(0).map((_, id) => ({
                                type: 'Feature',
                                id,
                                geometry: {
                                    type: 'Point',
                                    coordinates: id === 0 ? [95, 45] : [
                                        Math.random() * 360 - 180,
                                        Math.random() * 180 - 90
                                    ],
                                }
                            }))
                        }
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

        source.updateData({
            update: [{
                id: 0,
                newGeometry: {
                    type: 'Point',
                    coordinates: [85, 45],
                }
            }]
        });

        await new Promise(resolve => {
            this.map.once('idle', resolve);
        });
    }

    teardown() {
        this.map.remove();
    }
}

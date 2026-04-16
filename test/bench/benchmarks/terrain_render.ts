
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

export default class TerrainRender extends Benchmark {

    map: any;

    async setup() {
        try {
            this.map = await createMap({
                zoom: 12,
                width: 1024,
                height: 768,
                center: [10.5, 46.9],
                pitch: 60,
                style: 'https://tiles.openfreemap.org/styles/liberty',
                idle: true
            });

            this.map.addSource('terrain-dem', {
                type: 'raster-dem',
                url: 'https://tiles.mapterhorn.com/tilejson.json'
            });
            this.map.setTerrain({source: 'terrain-dem', exaggeration: 1.5});

            // Wait for DEM tiles to load
            await this.map.once('idle');
        } catch (error) {
            console.error(error);
        }
    }

    _bearing: number = 0;

    bench() {
        // Rotate the camera slightly each frame to force depth pre-pass to re-run
        // and symbol layers to recalculate visibility against terrain depth
        this._bearing = (this._bearing + 0.5) % 360;
        this.map.setBearing(this._bearing);
        Benchmark.renderMap(this.map);
    }

    teardown() {
        this.map.remove();
    }
}

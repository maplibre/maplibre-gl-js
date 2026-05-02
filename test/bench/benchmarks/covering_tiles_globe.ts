import Benchmark from '../lib/benchmark.ts';
import {GlobeTransform} from '../../../src/geo/projection/globe_transform.ts';
import {GlobeProjection} from '../../../src/geo/projection/globe_projection.ts';
import {LngLat} from '../styles/index.ts';
import {coveringTiles} from '../../../src/geo/projection/covering_tiles.ts';

export default class CoveringTilesGlobe extends Benchmark {
    _pitch: number;

    constructor(pitch: number) {
        super();
        this._pitch = pitch;
    }

    bench() {
        const transform = new GlobeTransform();
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(4);
        transform.resize(4096, 4096);
        transform.setMaxPitch(this._pitch);
        transform.setPitch(this._pitch);

        for (let i = 0; i < 40; i++) {
            transform.setCenter(new LngLat(i * 0.2, 0));
            coveringTiles(transform, {
                tileSize: 256,
            });
        }
    }
}

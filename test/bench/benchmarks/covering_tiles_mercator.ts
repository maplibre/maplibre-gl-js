import Benchmark from '../lib/benchmark';
import {LngLat} from '../styles';
import {coveringTiles} from '../../../src/geo/projection/covering_tiles';
import { MercatorTransform } from '../../../src/geo/projection/mercator_transform';

export default class CoveringTilesMercator extends Benchmark {
    _pitch: number;

    constructor(pitch: number) {
        super();
        this._pitch = pitch;
    }

    bench() {
        const transform = new MercatorTransform();
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

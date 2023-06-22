import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import type {Map} from '../../../src/ui/map';
import type {LngLatLike} from '../../../src/geo/lng_lat';

const width = 1024;
const height = 768;

const points = [];
const d = 4;
for (let x = 0; x < d; x++) {
    for (let y = 0; y < d; y++) {
        points.push([
            (x / d) * width,
            (y / d) * height
        ]);
    }
}

export default class QueryPoint extends Benchmark {
    style: string;
    locations: Array<{
        zoom: number;
        center: LngLatLike;
    }>;
    maps: Array<Map>;

    constructor(style: string, locations: Array<any>) {
        super();
        this.style = style;
        this.locations = locations;
    }

    async setup() {
        try {
            this.maps = await Promise.all(this.locations.map(location => {
                return createMap({
                    zoom: location.zoom,
                    width,
                    height,
                    center: location.center,
                    style: this.style
                });
            }));
        } catch (error) {
            console.error(error);
        }
    }

    bench() {
        for (const map of this.maps) {
            for (const point of points) {
                map.queryRenderedFeatures(point, {});
            }
        }
    }

    teardown() {
        for (const map of this.maps) {
            map.remove();
        }
    }
}

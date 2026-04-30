import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import type {Map} from '../../../src/ui/map';

const width = 1024;
const height = 768;

export default class Paint extends Benchmark {
    style: string;
    locations: any[];
    maps: Map[];

    constructor(style: string, locations: any[]) {
        super();
        this.style = style;
        this.locations = locations;
    }

    async setup(): Promise<void> {
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

    bench(): void {
        for (const map of this.maps) {
            map._styleDirty = true;
            map._sourcesDirty = true;
            Benchmark.renderMap(map);
        }
    }

    teardown(): void {
        for (const map of this.maps) {
            map.remove();
        }
    }
}

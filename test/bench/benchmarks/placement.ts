import Benchmark from '../lib/benchmark.ts';
import createMap from '../lib/create_map.ts';
import type {Map} from '../../../src/ui/map.ts';

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
                    style: this.style,
                    idle: true
                });
            }));
        } catch (error) {
            console.error(error);
        }
    }

    bench(): void {
        for (const map of this.maps) {
            const showCollisionBoxes = false;
            const fadeDuration = 300;
            const crossSourceCollisions = true;
            const forceFullPlacement = true;

            map.style._updatePlacement(
                map.transform,
                showCollisionBoxes,
                fadeDuration,
                crossSourceCollisions,
                forceFullPlacement);
        }
    }

    teardown(): void {
        for (const map of this.maps) {
            map.remove();
        }
    }
}

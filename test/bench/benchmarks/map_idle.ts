
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

/**
 * Measures how long it takes the map to reach the idle state where all content for the view has been loaded and rendered.
 */
export default class MapIdle extends Benchmark {
    constructor() {
        super();

        // This is a longer running test and the duration will vary by device and network.
        // To keep the test time more reasonable, lower the minimum number of measurements.
        this.minimumMeasurements = 40;
    }

    /**
     * Waits for map's idle event before returning.
     */
    async createMap(): Promise<void> {
        return createMap({
            style: 'https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
            idle: true,
            center: [-77.032194, 38.912753],
            zoom: 15
        })
            .then(map => map.remove())
            .catch(error => {
                console.error(error);
            });
    }

    setup(): Promise<void> {
        // warmup network cache
        return this.createMap();
    }

    bench(): Promise<void> {
        return this.createMap();
    }
}

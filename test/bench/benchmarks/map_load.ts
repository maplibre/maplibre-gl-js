
import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';

/**
 * Measures how long it takes a basic map to reach the loaded state,
 * using an empty style with no sources or layers.
 */
export default class MapLoad extends Benchmark {
    async bench() {
        try {
            const map = await createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });
            map.remove();
        } catch (error) {
            console.error(error);
        }
    }
}

import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import {
    installTerrainBenchProtocols,
    buildTerrainBenchStyle,
    TERRAIN_BENCH_CAMERA,
} from '../lib/terrain_style';
import type {Map} from '../../../src/ui/map';

// Measures steady-state per-render cost with terrain enabled and a
// contrived many-layer style. The map is created once, loaded to idle,
// then each iteration rotates the camera slightly and renders. Tiles
// and shaders are already warm so this measures the fast path.
// For full load-to-idle cost see terrain_load.ts.
export default class TerrainRender extends Benchmark {
    map: Map;
    uninstallProtocols: () => void;
    _bearing = TERRAIN_BENCH_CAMERA.bearing;

    async setup() {
        this.uninstallProtocols = await installTerrainBenchProtocols();

        this.map = await createMap({
            ...TERRAIN_BENCH_CAMERA,
            style: buildTerrainBenchStyle(),
            fadeDuration: 0,
            stubRender: false,
            showMap: true,
            idle: true,
        });

        this.map.setTerrain({source: 'dem', exaggeration: 1});
        await new Promise(resolve => this.map.once('idle', resolve));
    }

    bench() {
        // Rotate the camera slightly each frame to force the depth
        // pre-pass to re-run and symbol layers to recalculate visibility
        // against terrain depth.
        this._bearing = (this._bearing + 0.5) % 360;
        this.map.setBearing(this._bearing);
        Benchmark.renderMap(this.map);
    }

    teardown() {
        this.map.remove();
        this.uninstallProtocols?.();
    }
}

import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import {
    installTerrainBenchProtocols,
    buildTerrainBenchStyle,
    TERRAIN_BENCH_CAMERA,
} from '../lib/terrain_style';
import type {Map} from '../../../src/ui/map';
import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

// Measures wall time from map instantiation to idle with terrain enabled
// and a contrived many-layer style. This is the path where dropped frames
// typically happen in practice: the first render after new tiles arrive.
// For steady-state re-render cost (the fast path) see terrain_render.ts.
export default class TerrainLoad extends Benchmark {
    style: StyleSpecification;
    uninstallProtocols: () => void;

    constructor() {
        super();
        // Each iteration creates a fresh Map, waits for idle, then tears
        // it down. That's expensive, so keep the iteration count low.
        // 55 measurements => 10 observations for regression.
        this.minimumMeasurements = 55;
    }

    async setup() {
        this.uninstallProtocols = await installTerrainBenchProtocols();
        this.style = buildTerrainBenchStyle();

        // Warmup: create and discard one map to prime glyph atlases,
        // shader programs, and browser caches for any non-tile URLs.
        await this.createAndIdle();
    }

    async createAndIdle() {
        const map: Map = await createMap({
            ...TERRAIN_BENCH_CAMERA,
            style: this.style,
            fadeDuration: 0,
            stubRender: false,
            showMap: true,
            idle: true,
        });

        map.setTerrain({source: 'dem', exaggeration: 1});
        await new Promise(resolve => map.once('idle', resolve));
        map.remove();
    }

    async bench() {
        await this.createAndIdle();
    }

    teardown() {
        this.uninstallProtocols?.();
    }
}

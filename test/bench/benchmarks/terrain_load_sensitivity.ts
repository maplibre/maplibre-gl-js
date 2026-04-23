import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import {
    installTerrainBenchProtocols,
    buildTerrainBenchStyle,
    TERRAIN_BENCH_CAMERA,
} from '../lib/terrain_style';
import type {Map} from '../../../src/ui/map';
import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

// Temporary variants used for benchmark sensitivity testing. These should
// be removed once the core TerrainLoad benchmark is validated.
export class TerrainLoadBase extends Benchmark {
    style: StyleSpecification;
    uninstallProtocols: () => void;
    terrainOn = true;
    scale = 1;

    constructor() {
        super();
        this.minimumMeasurements = 55;
    }

    async setup() {
        this.uninstallProtocols = await installTerrainBenchProtocols();
        this.style = buildTerrainBenchStyle({scale: this.scale});
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

        if (this.terrainOn) {
            map.setTerrain({source: 'dem', exaggeration: 1});
            await new Promise(resolve => map.once('idle', resolve));
        }
        map.remove();
    }

    async bench() {
        await this.createAndIdle();
    }

    teardown() {
        this.uninstallProtocols?.();
    }
}

export class TerrainLoadTerrainOff extends TerrainLoadBase {
    override terrainOn = false;
}

export class TerrainLoadFewLayers extends TerrainLoadBase {
    override scale = 0.1;
}

export class TerrainLoadManyLayers extends TerrainLoadBase {
    override scale = 5;
}

export class TerrainLoadVeryManyLayers extends TerrainLoadBase {
    override scale = 20;
}

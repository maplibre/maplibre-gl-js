import Benchmark, {type Measurement} from '../lib/benchmark';
import createMap from '../lib/create_map';
import type {Map} from '../../../src/ui/map';
import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

// Worst-frame timing for a scripted flyTo. One bench class per
// (terrain on/off) x (mercator/globe) combo so we can compare all four in
// a single bench run.

const STYLE_COMPLEXITY = 100;
const DURATION = 1_000;
const ITERATIONS = 10;

const CENTER_START: [number, number] = [0.0, 0.15];
const CENTER_END: [number, number] = [0.0, -0.15];
const ZOOM = 12;
const PITCH = 85;
const BEARING = 180;

type Variant = {
    terrain: boolean;
    projection: 'mercator' | 'globe';
};

class TerrainBase extends Benchmark {
    map: Map;
    variant: Variant;
    label: string;

    constructor(label: string, variant: Variant) {
        super();
        this.label = label;
        this.variant = variant;
    }

    async setup() {
        const style = buildStyle();
        style.projection = {type: this.variant.projection};

        this.map = await createMap({
            center: CENTER_START,
            zoom: ZOOM,
            pitch: PITCH,
            bearing: BEARING,
            maxPitch: 85,
            width: 393,
            height: 852,
            style,
            fadeDuration: 0,
            stubRender: false,
            showMap: true,
            idle: true,
        });

        if (this.variant.terrain) {
            this.map.setTerrain({source: 'dem', exaggeration: 1});
        }

        await new Promise(resolve => this.map.once('idle', resolve));
    }

    // The parent `Bench` class doesn't support custom metrics so we override 
    // `run` and report each pass as a `Measurement` whose `time` is the worst 
    // frame interval in ms.
    async run(): Promise<Measurement[]> {
        try {
            await this.setup();

            // Warmup
            await this.runInner();

            const measurements: Measurement[] = [];
            for (let i = 0; i < ITERATIONS; i++) {
                measurements.push({time: await this.runInner(), iterations: 1});
            }

            this.teardown();
            return measurements;
        } catch (e) {
            console.error(e);
        }
    }

    teardown() {
        this.map.remove();
    }

    private async runInner(): Promise<number> {
        // Clear existing caches
        for (const id in this.map.style.tileManagers) {
            this.map.style.tileManagers[id].clearTiles();
        }
        if (this.variant.terrain) {
            this.map.setTerrain(null);
            this.map.setTerrain({source: 'dem', exaggeration: 1});
        }

        this.map.jumpTo({center: CENTER_START, zoom: ZOOM, pitch: PITCH, bearing: BEARING});
        await new Promise(resolve => this.map.once('idle', resolve));

        const frameTimes: number[] = [];
        let prevTime: number | undefined;
        let running = true;
        const onFrame = (time: number) => {
            if (!running) return;
            if (prevTime !== undefined) frameTimes.push(time - prevTime);
            prevTime = time;
            requestAnimationFrame(onFrame);
        };
        requestAnimationFrame(onFrame);

        this.map.flyTo({
            center: CENTER_END,
            zoom: ZOOM,
            pitch: PITCH,
            bearing: BEARING,
            duration: DURATION,
            curve: 1,
            minZoom: ZOOM,
            easing: t => t,
        });
        await new Promise(resolve => this.map.once('moveend', resolve));
        running = false;
        frameTimes.shift();

        let maxTime = 0;
        for (const t of frameTimes) if (t > maxTime) maxTime = t;
        return maxTime;
    }
}

export class Terrain3DGlobe extends TerrainBase {
    constructor() { super('Terrain3DGlobe', {terrain: true, projection: 'globe'}); }
}
export class Terrain3DMercator extends TerrainBase {
    constructor() { super('Terrain3DMercator', {terrain: true, projection: 'mercator'}); }
}
export class Terrain2DGlobe extends TerrainBase {
    constructor() { super('Terrain2DGlobe', {terrain: false, projection: 'globe'}); }
}
export class Terrain2DMercator extends TerrainBase {
    constructor() { super('Terrain2DMercator', {terrain: false, projection: 'mercator'}); }
}

// Create a basemap-like style that uses the layers from the bundled 
// `785.vector.pbf` vector tile. Each layer is duplicated `STYLE_COMPLEXITY` 
// times to simulate a more complex basemap style and stress the system.
function buildStyle(): StyleSpecification {
    const layers: StyleSpecification['layers'] = [
        {id: 'background', type: 'background', paint: {'background-color': '#f0ece0'}},
    ];

    const baseLayers: StyleSpecification['layers'] = [
        {
            id: 'landuse',
            type: 'fill',
            source: 'vector',
            'source-layer': 'landuse',
            paint: {'fill-color': '#d0e0a0', 'fill-opacity': 0.6},
        },
        {
            id: 'landuse_overlay',
            type: 'fill',
            source: 'vector',
            'source-layer': 'landuse_overlay',
            paint: {'fill-color': '#c8dca0', 'fill-opacity': 0.5},
        },
        {
            id: 'water',
            type: 'fill',
            source: 'vector',
            'source-layer': 'water',
            paint: {'fill-color': '#a0c8f0'},
        },
        {
            id: 'waterway',
            type: 'line',
            source: 'vector',
            'source-layer': 'waterway',
            paint: {'line-color': '#80a8d0', 'line-width': 1.2},
        },
        {
            id: 'road_casing',
            type: 'line',
            source: 'vector',
            'source-layer': 'road',
            paint: {'line-color': '#888', 'line-width': 4, 'line-opacity': 0.6},
        },
        {
            id: 'road',
            type: 'line',
            source: 'vector',
            'source-layer': 'road',
            paint: {
                'line-color': ['match', ['get', 'class'],
                    'motorway', '#fc8',
                    'trunk', '#fc8',
                    'primary', '#fea',
                    'secondary', '#ffd',
                    /* default */ '#fff',
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 16, 6],
            },
        },
        {
            id: 'road_label',
            type: 'symbol',
            source: 'vector',
            'source-layer': 'road_label',
            layout: {
                'symbol-placement': 'line',
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
            },
            paint: {'text-color': '#333', 'text-halo-color': '#fff', 'text-halo-width': 1},
        },
        {
            id: 'poi_circle',
            type: 'circle',
            source: 'vector',
            'source-layer': 'poi_label',
            paint: {
                'circle-radius': 3,
                'circle-color': '#a55',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff',
            },
        },
        {
            id: 'poi_label',
            type: 'symbol',
            source: 'vector',
            'source-layer': 'poi_label',
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 10,
                'text-offset': [0, 0.8],
                'text-anchor': 'top',
            },
            paint: {'text-color': '#553', 'text-halo-color': '#fff', 'text-halo-width': 1},
        },
        {
            id: 'place_label',
            type: 'symbol',
            source: 'vector',
            'source-layer': 'place_label',
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['get', 'localrank'], 1, 16, 10, 11],
                'text-allow-overlap': false,
            },
            paint: {'text-color': '#222', 'text-halo-color': '#fff', 'text-halo-width': 1.5},
        },
    ];

    for (let i = 0; i < STYLE_COMPLEXITY; i++) {
        for (const layer of baseLayers) {
            layers.push({...layer, id: `${layer.id}_${i}`} as any);
        }
    }

    return {
        version: 8,
        glyphs: '/test/integration/assets/glyphs/{fontstack}/{range}.pbf',
        sources: {
            vector: {
                type: 'vector',
                // Tiles point at static fixtures served by the dev server: a single
                // vector tile and a single DEM tile, reused for every z/x/y. The
                // {z}/{x}/{y} placeholders go in query params so each tile gets a
                // distinct cache key in MapLibre's tile cache.
                tiles: [`${location.origin}/test/bench/data/785.vector.pbf?id={z}/{x}/{y}`],
                minzoom: 0,
                maxzoom: 14,
            },
            dem: {
                type: 'raster-dem',
                tiles: [`${location.origin}/test/bench/data/terrain_dem.png?id={z}/{x}/{y}`],
                tileSize: 256,
                encoding: 'terrarium',
                minzoom: 0,
                maxzoom: 14,
            },
        },
        layers,
    };
}

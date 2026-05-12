import {type BenchmarkLike, type Measurement} from '../lib/benchmark.ts';
import createMap from '../lib/create_map.ts';
import type {Map} from '../../../src/ui/map.ts';
import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

// STYLE_COMPLEXITY * 10 = number of layers in the style
// This parameter tuned the highest possible value at which Terrain2DMercator is around 2ms on desktop (60 FPS)
const STYLE_COMPLEXITY = 32;

const MEASUREMENT_COUNT = 10;
const DURATION = 1_000;
const FRAME_BUDGET = 1000 / 60;
const CENTER_START: [number, number] = [0.0, 0.15];
const CENTER_END: [number, number] = [0.0, -0.15];
const ZOOM = 12;
const PITCH = 85;
const BEARING = 180;

class TerrainBase implements BenchmarkLike {
    map: Map;
    label: string;
    terrain: boolean;
    projection: 'mercator' | 'globe';

    constructor(label: string, terrain: boolean, projection: 'mercator' | 'globe') {
        this.label = label;
        this.terrain = terrain;
        this.projection = projection;
    }

    async setup(): Promise<void> {
        const style = buildStyle();
        style.projection = {type: this.projection};

        this.map = await createMap({
            center: CENTER_START,
            zoom: ZOOM,
            pitch: PITCH,
            bearing: BEARING,
            maxPitch: PITCH,
            width: 393,
            height: 852,
            style,
            fadeDuration: 0,
            stubRender: false,
            showMap: true,
            idle: true,
        });

        if (this.terrain) {
            this.map.setTerrain({source: 'dem', exaggeration: 1});
            await this.map.once('idle');
        }

        // Warm the HTTP, glyph, and sprite caches
        await this.bench();
    }

    async run(): Promise<Measurement[]> {
        try {
            await this.setup();

            const measurements: Measurement[] = [];
            for (let i = 0; i < MEASUREMENT_COUNT; i++) {
                measurements.push({time: await this.bench(), iterations: 1});
            }

            this.teardown();
            return measurements;
        } catch (e) {
            console.error(e);
        }
    }

    teardown(): void {
        this.map.remove();
    }

    private async bench(): Promise<number> {
        // Clear tile and terrain caches
        for (const id in this.map.style.tileManagers) {
            this.map.style.tileManagers[id].clearTiles();
        }
        if (this.terrain) {
            this.map.setTerrain(null);
            this.map.setTerrain({source: 'dem', exaggeration: 1});
        }

        // Reset the map viewport
        this.map.jumpTo({center: CENTER_START, zoom: ZOOM, pitch: PITCH, bearing: BEARING});
        await this.map.once('idle');

        // Animate the map and collect frame times
        const times: number[] = [];
        let prevTime: number | undefined;
        let running = true;
        const onFrame = (time: number) => {
            if (!running) return;
            if (prevTime !== undefined) times.push(time - prevTime);
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
        await this.map.once('moveend');
        running = false;

        // Return the total time spent over budget across all frames (jank-sum).
        // How much time did the user spent looking at animation stutters?
        times.shift();
        let jankSum = 0;
        for (const time of times) if (time > FRAME_BUDGET) jankSum += time - FRAME_BUDGET;
        return jankSum;
    }
}

export class Terrain3DGlobe extends TerrainBase {
    constructor() { super('Terrain3DGlobe', true, 'globe'); }
}
export class Terrain3DMercator extends TerrainBase {
    constructor() { super('Terrain3DMercator', true, 'mercator'); }
}
export class Terrain2DGlobe extends TerrainBase {
    constructor() { super('Terrain2DGlobe', false, 'globe'); }
}
export class Terrain2DMercator extends TerrainBase {
    constructor() { super('Terrain2DMercator', false, 'mercator'); }
}

/**
 * Create a basemap style that uses the features from the bundled
 * `785.vector.pbf` tile. Each layer is duplicated `STYLE_COMPLEXITY` times to
 * simulate a more complex basemap style and stress the system.
 */
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
                tiles: [`${location.origin}/test/bench/data/785.vector.pbf?id={z}/{x}/{y}`],
                minzoom: 0,
                maxzoom: 14,
            },
            dem: {
                type: 'raster-dem',
                tiles: [`${location.origin}/test/bench/data/terrain_dem.png?id={z}/{x}/{y}`],
                encoding: 'terrarium',
                minzoom: 0,
                maxzoom: 14,
            },
        },
        layers,
    };
}

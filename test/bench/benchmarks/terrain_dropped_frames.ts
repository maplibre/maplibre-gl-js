import Benchmark, {type Measurement} from '../lib/benchmark';
import createMap from '../lib/create_map';
import {addProtocol, removeProtocol} from '../../../src/source/protocol_crud';
import type {Map} from '../../../src/ui/map';
import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

// Measures the worst frame time during a scripted flyTo, parameterized
// over terrain on/off and projection mercator/globe so we can compare the
// four combinations in a single bench run.
//
// All resources are local. The bench-vector protocol returns a single
// bundled tile for every z/x/y; bench-dem does the same for the DEM;
// glyphs come from the integration test fixtures.
//
// The harness's regression machinery is built for sync per-iteration
// timing, so this benchmark overrides run() and reports each pass as a
// single measurement whose "time" is the max frame interval in ms.

const VECTOR_PROTOCOL = 'bench-vector';
const DEM_PROTOCOL = 'bench-dem';

// Crank this up until you see dropped frames on the target machine. Each
// layer in the base style is emitted N times, so LAYER_DUPLICATION=4
// produces 4x the per-frame draw calls and shader switches.
const LAYER_DUPLICATION = 64;

// Linear flight from Innsbruck south up the Wipptal toward the Brenner pass.
const START: [number, number] = [11.40, 47.27];
const END: [number, number] = [11.50, 47.00];
const ZOOM = 12;
const PITCH = 85;
const BEARING = 180;
const FLIGHT_MS = 1_000;
const ITERATIONS = 10;

type Variant = {
    terrain: boolean;
    projection: 'mercator' | 'globe';
};

class FlyDroppedFramesBench extends Benchmark {
    map: Map;
    uninstallProtocols: () => void;
    variant: Variant;
    label: string;

    constructor(label: string, variant: Variant) {
        super();
        this.label = label;
        this.variant = variant;
    }

    async setup() {
        const vectorBuffer = await (await fetch('/test/bench/data/785.vector.pbf')).arrayBuffer();
        const demBuffer = await (await fetch('/test/bench/data/terrain_dem.png')).arrayBuffer();

        addProtocol(VECTOR_PROTOCOL, async () => ({data: vectorBuffer.slice(0)}));
        addProtocol(DEM_PROTOCOL, async () => ({data: demBuffer.slice(0)}));
        this.uninstallProtocols = () => {
            removeProtocol(VECTOR_PROTOCOL);
            removeProtocol(DEM_PROTOCOL);
        };

        const style = buildStyle();
        style.projection = {type: this.variant.projection};

        this.map = await createMap({
            center: START,
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
            await new Promise(resolve => this.map.once('idle', resolve));
        }
    }

    async run(): Promise<Measurement[]> {
        try {
            await this.setup();

            // Warmup flight: not counted, but lets tile / shader / glyph
            // caches reach steady state before measurement.
            await this.flyAndMeasureMaxFrame();

            const measurements: Measurement[] = [];
            for (let i = 0; i < ITERATIONS; i++) {
                const maxFrameMs = await this.flyAndMeasureMaxFrame();
                console.log(`${this.label} iter ${i}: max frame ${maxFrameMs.toFixed(1)}ms`);
                measurements.push({time: maxFrameMs, iterations: 1});
            }

            this.teardown();
            return measurements;
        } catch (e) {
            console.error(e);
        }
    }

    teardown() {
        this.map.remove();
        this.uninstallProtocols?.();
    }

    private async flyAndMeasureMaxFrame(): Promise<number> {
        this.map.jumpTo({center: START, zoom: ZOOM, pitch: PITCH, bearing: BEARING});
        await new Promise(resolve => this.map.once('idle', resolve));

        const frameTimes: number[] = [];
        let lastTs: number | undefined;
        let running = true;
        const onFrame = (ts: number) => {
            if (!running) return;
            if (lastTs !== undefined) frameTimes.push(ts - lastTs);
            lastTs = ts;
            requestAnimationFrame(onFrame);
        };
        requestAnimationFrame(onFrame);

        this.map.flyTo({
            center: END,
            zoom: ZOOM,
            pitch: PITCH,
            bearing: BEARING,
            duration: FLIGHT_MS,
            curve: 1,
            minZoom: ZOOM,
            easing: t => t,
        });
        await new Promise(resolve => this.map.once('moveend', resolve));
        running = false;

        // Drop the first frame: flyTo startup is a transient.
        frameTimes.shift();

        let max = 0;
        for (const t of frameTimes) if (t > max) max = t;
        return max;
    }
}

export class Terrain3DGlobe extends FlyDroppedFramesBench {
    constructor() { super('Terrain3DGlobe', {terrain: true, projection: 'globe'}); }
}
export class Terrain3DMercator extends FlyDroppedFramesBench {
    constructor() { super('Terrain3DMercator', {terrain: true, projection: 'mercator'}); }
}
export class Terrain2DGlobe extends FlyDroppedFramesBench {
    constructor() { super('Terrain2DGlobe', {terrain: false, projection: 'globe'}); }
}
export class Terrain2DMercator extends FlyDroppedFramesBench {
    constructor() { super('Terrain2DMercator', {terrain: false, projection: 'mercator'}); }
}

// Build a synthetic basemap-style style covering the source-layers
// present in the bundled 785.vector.pbf: landuse, water, waterway, road,
// road_label, place_label, poi_label. Layer types covered: background,
// fill, line (casing + fill), symbol (point), symbol (line), circle.
//
// Each "base" layer is emitted LAYER_DUPLICATION times with slightly
// varied paint so the renderer can't trivially batch them.
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

    for (let dup = 0; dup < LAYER_DUPLICATION; dup++) {
        for (const layer of baseLayers) {
            layers.push({...layer, id: `${layer.id}_${dup}`} as any);
        }
    }

    return {
        version: 8,
        glyphs: '/test/integration/assets/glyphs/{fontstack}/{range}.pbf',
        sources: {
            vector: {
                type: 'vector',
                tiles: [`${VECTOR_PROTOCOL}://{z}/{x}/{y}`],
                minzoom: 0,
                maxzoom: 14,
            },
            dem: {
                type: 'raster-dem',
                tiles: [`${DEM_PROTOCOL}://{z}/{x}/{y}`],
                tileSize: 256,
                encoding: 'terrarium',
                minzoom: 0,
                maxzoom: 14,
            },
        },
        layers,
    };
}

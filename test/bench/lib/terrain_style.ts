import {addProtocol, removeProtocol} from '../../../src/source/protocol_crud';
import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

// Shared scaffolding for terrain benchmarks. Serves bundled tiles over a
// custom protocol (no network) and builds a contrived many-layer style
// large enough to stress the renderer.

const VECTOR_PROTOCOL = 'bench-vector';
const DEM_PROTOCOL = 'bench-dem';

let vectorBuffer: ArrayBuffer | null = null;
let demBuffer: ArrayBuffer | null = null;

// Registers the bench-vector and bench-dem protocols. Idempotent.
// Returns a function to unregister both.
export async function installTerrainBenchProtocols(): Promise<() => void> {
    if (!vectorBuffer) {
        vectorBuffer = await (await fetch('/test/bench/data/785.vector.pbf')).arrayBuffer();
    }
    if (!demBuffer) {
        demBuffer = await (await fetch('/test/bench/data/terrain_dem.png')).arrayBuffer();
    }

    addProtocol(VECTOR_PROTOCOL, async () => ({data: vectorBuffer!.slice(0)}));
    addProtocol(DEM_PROTOCOL, async () => ({data: demBuffer!.slice(0)}));

    return () => {
        removeProtocol(VECTOR_PROTOCOL);
        removeProtocol(DEM_PROTOCOL);
    };
}

// Contrived style built over the source-layers present in
// test/bench/data/785.vector.pbf. 60 fill + 120 line + 6 symbol layers
// plus a background — enough to produce realistic render workload without
// needing a full OMT tile.
export function buildTerrainBenchStyle(opts: {scale?: number} = {}): StyleSpecification {
    // scale=1 (default) builds the full 187-layer style. scale=0.1 builds a
    // stripped-down ~20-layer style for sensitivity testing.
    const scale = opts.scale ?? 1;
    const fillCount = Math.round(60 * scale);
    const lineCount = Math.round(120 * scale);
    const symbolCount = Math.max(1, Math.round(6 * scale));

    const layers: StyleSpecification['layers'] = [
        {id: 'background', type: 'background', paint: {'background-color': '#f0ece0'}}
    ];

    const fillSources = [
        {sourceLayer: 'landuse', base: '#d0e0a0'},
        {sourceLayer: 'landuse_overlay', base: '#c8dca0'},
        {sourceLayer: 'water', base: '#a0c8f0'},
    ];
    for (let i = 0; i < fillCount; i++) {
        const s = fillSources[i % fillSources.length];
        layers.push({
            id: `fill_${i}`,
            type: 'fill',
            source: 'vector',
            'source-layer': s.sourceLayer,
            paint: {'fill-color': s.base, 'fill-opacity': 0.05 + 0.01 * (i % 20)}
        });
    }

    const lineSources = [
        {sourceLayer: 'road', width: 1.5},
        {sourceLayer: 'waterway', width: 1.0},
        {sourceLayer: 'road_label', width: 0.5},
    ];
    for (let i = 0; i < lineCount; i++) {
        const s = lineSources[i % lineSources.length];
        layers.push({
            id: `line_${i}`,
            type: 'line',
            source: 'vector',
            'source-layer': s.sourceLayer,
            paint: {
                'line-color': `hsla(${(i * 47) % 360}, 40%, 40%, 0.2)`,
                'line-width': s.width + (i % 5) * 0.3,
            }
        });
    }

    // Symbol layers break the RTT stack into multiple passes, a major
    // factor in terrain rendering cost.
    for (let i = 0; i < symbolCount; i++) {
        layers.push({
            id: `symbol_${i}`,
            type: 'symbol',
            source: 'vector',
            'source-layer': 'place_label',
            layout: {
                'text-field': ['get', 'name'],
                'text-size': 10 + i,
                'text-allow-overlap': true,
            },
            paint: {'text-color': `hsl(${i * 60}, 50%, 20%)`},
        });
    }

    return {
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
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

export const TERRAIN_BENCH_CAMERA = {
    center: [11.4, 47.27] as [number, number],
    zoom: 12,
    pitch: 80,
    bearing: 180,
    maxPitch: 85,
    width: 512,
    height: 768,
};

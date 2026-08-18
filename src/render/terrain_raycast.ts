import {EXTENT} from '../data/extent.ts';
import type {Terrain, TerrainElevationSampler} from './terrain.ts';

const MAX_BISECTIONS = 40;
/** Absorbs rounding when a bracket endpoint lands exactly on the terrain surface. */
export const HIT_EPSILON_M = 1e-6;
/** Keeps the elevation bracket non-degenerate when the terrain is entirely flat, such as unloaded DEMs. */
const BRACKET_PADDING_M = 10;
/** `DEMData.sampleBilinear` throws on the far tile edge, so samples stop just short of it. */
const MAX_TILE_COORD = EXTENT * (1 - 1e-12);

export type TerrainSample = {
    covered: boolean;
    elevation: number;
};

export type TerrainCoverageIndex = {
    zooms: number[];
    tiles: Map<string, TerrainElevationSampler | null>;
    minElevation: number;
    maxElevation: number;
};

const NOT_COVERED: TerrainSample = {covered: false, elevation: 0};

/**
 * Indexes the tiles the terrain currently renders so a ray can be tested against them without the GPU.
 */
export function buildCoverageIndex(terrain: Terrain): TerrainCoverageIndex | null {
    const zooms: number[] = [];
    const tiles = new Map<string, TerrainElevationSampler | null>();
    let minElevation = 0;
    let maxElevation = 0;

    for (const tile of terrain.tileManager.getRenderableTiles()) {
        if (!tile) continue;
        const {canonical, wrap} = tile.tileID;
        if (!zooms.includes(canonical.z)) zooms.push(canonical.z);
        const sampler = terrain.getElevationSampler(tile.tileID);
        tiles.set(`${wrap}/${canonical.z}/${canonical.x}/${canonical.y}`, sampler);
        const {minElevation: tileMin, maxElevation: tileMax} = terrain.getMinMaxElevation(tile.tileID);
        minElevation = Math.min(minElevation, tileMin ?? 0);
        maxElevation = Math.max(maxElevation, tileMax ?? 0);
    }

    if (tiles.size === 0) return null;
    zooms.sort((a, b) => b - a);
    return {zooms, tiles, minElevation: minElevation - BRACKET_PADDING_M, maxElevation: maxElevation + BRACKET_PADDING_M};
}

/**
 * Elevation of the rendered terrain surface at a mercator position, and whether it is covered at all.
 * A covered tile whose DEM has not loaded yet is flat at zero, which is what the terrain mesh renders.
 */
export function sampleAt(index: TerrainCoverageIndex, exaggeration: number, mercatorX: number, mercatorY: number): TerrainSample {
    if (mercatorY < 0 || mercatorY >= 1) return NOT_COVERED;
    const wrap = Math.floor(mercatorX);
    const wrappedX = mercatorX - wrap;

    for (const z of index.zooms) {
        const scale = 1 << z;
        const scaledX = wrappedX * scale;
        const scaledY = mercatorY * scale;
        const tileX = Math.floor(scaledX);
        const tileY = Math.floor(scaledY);
        const key = `${wrap}/${z}/${tileX}/${tileY}`;
        if (!index.tiles.has(key)) continue;
        const sampler = index.tiles.get(key);
        if (!sampler) return {covered: true, elevation: 0};
        const x = Math.min((scaledX - tileX) * EXTENT, MAX_TILE_COORD);
        const y = Math.min((scaledY - tileY) * EXTENT, MAX_TILE_COORD);
        return {covered: true, elevation: sampler(x, y, EXTENT) * exaggeration};
    }
    return NOT_COVERED;
}

/**
 * Narrows the bracket `[lo, hi]` around the surface crossing until it is shorter than `tolerance` in ray parameter units.
 */
export function bisect<Ray>(ray: Ray, isBelowTerrain: (ray: Ray, t: number) => boolean, lo: number, hi: number, tolerance: number): {lo: number; hi: number} {
    for (let j = 0; j < MAX_BISECTIONS && hi - lo > tolerance; j++) {
        const mid = (lo + hi) / 2;
        if (isBelowTerrain(ray, mid)) hi = mid;
        else lo = mid;
    }
    return {lo, hi};
}

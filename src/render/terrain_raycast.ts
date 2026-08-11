import {vec3} from 'gl-matrix';
import {EXTENT} from '../data/extent.ts';
import {earthRadius} from '../geo/lng_lat.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {raySphereIntersection, sphereSurfacePointToCoordinates} from '../geo/projection/globe_utils.ts';
import {clamp, createVec3f64, MAX_VALID_LATITUDE} from '../util/util.ts';
import type Point from '@mapbox/point-geometry';
import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Terrain} from './terrain.ts';

const TARGET_SCREEN_STEP_PX = 4;
const MAX_SAMPLES = 512;
const GLOBE_SAMPLES = 256;
const MAX_BISECTIONS = 40;
const MERCATOR_BISECT_EPSILON_PX = 1e-3;
const GLOBE_BISECT_EPSILON_T = 1e-12;
/** Absorbs rounding when a bracket endpoint lands exactly on the terrain surface. */
const HIT_EPSILON_M = 1e-6;
/** Keeps the elevation bracket non-degenerate when the terrain is entirely flat, such as unloaded DEMs. */
const BRACKET_PADDING_M = 10;
/** `DEMData.sampleBilinear` throws on the far tile edge, so samples stop just short of it. */
const MAX_TILE_COORD = EXTENT * (1 - 1e-12);
/** Latitudes outside the mercator range project past the world edge; the globe mesh still covers them. */
const MAX_MERCATOR_Y = 1 - 1e-9;

type ElevationSampler = (x: number, y: number, extent: number) => number;

type TerrainSample = {
    covered: boolean;
    elevation: number;
};

type CoverageIndex = {
    zooms: number[];
    tiles: Map<string, ElevationSampler | null>;
    minElevation: number;
    maxElevation: number;
};

const NOT_COVERED: TerrainSample = {covered: false, elevation: 0};

/**
 * Indexes the tiles the terrain currently renders so a ray can be tested against them without the GPU.
 */
function buildCoverageIndex(terrain: Terrain): CoverageIndex | null {
    const zooms: number[] = [];
    const tiles = new Map<string, ElevationSampler | null>();
    let minElevation = 0;
    let maxElevation = 0;

    for (const tile of terrain.tileManager.getRenderableTiles()) {
        if (!tile) continue;
        const {canonical, wrap} = tile.tileID;
        if (!zooms.includes(canonical.z)) zooms.push(canonical.z);
        const sampler = terrain._getElevationSampler(tile.tileID);
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
function sampleAt(index: CoverageIndex, exaggeration: number, mercatorX: number, mercatorY: number): TerrainSample {
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
 * Intersects the ray through a screen pixel with the rendered terrain surface under a mercator transform.
 * @param transform - the transform the terrain is rendered with
 * @param terrain - the terrain
 * @param p - screen coordinate
 * @returns the mercator coordinate of the nearest hit with z in meters, or null when the ray misses the terrain
 */
export function raycastTerrainMercator(transform: IReadonlyTransform, terrain: Terrain, p: Point): MercatorCoordinate | null {
    const index = buildCoverageIndex(terrain);
    if (!index) return null;

    const {near, far} = transform.getRaySegmentFromPixel(p);
    const worldSize = transform.worldSize;
    const dx = far[0] - near[0];
    const dy = far[1] - near[1];
    const dz = far[2] - near[2];

    let tStart = 0;
    let tEnd = 1;
    if (dz === 0) {
        if (near[2] > index.maxElevation || near[2] < index.minElevation) return null;
    } else {
        const tHigh = (index.maxElevation - near[2]) / dz;
        const tLow = (index.minElevation - near[2]) / dz;
        tStart = Math.max(tStart, Math.min(tHigh, tLow));
        tEnd = Math.min(tEnd, Math.max(tHigh, tLow));
        if (tStart > tEnd) return null;
    }

    const horizontalLength = Math.hypot(dx, dy);
    const samples = clamp(Math.ceil(horizontalLength * (tEnd - tStart) / TARGET_SCREEN_STEP_PX), 1, MAX_SAMPLES);
    const sampleRay = (t: number) => sampleAt(index, terrain.exaggeration, (near[0] + t * dx) / worldSize, (near[1] + t * dy) / worldSize);
    const isBelowTerrain = (t: number) => {
        const sample = sampleRay(t);
        return sample.covered && near[2] + t * dz <= sample.elevation + HIT_EPSILON_M;
    };

    let previousT = 0;
    let aboveTerrain = !isBelowTerrain(0);

    for (let i = 0; i <= samples; i++) {
        const t = tStart + (tEnd - tStart) * i / samples;

        if (!aboveTerrain) {
            aboveTerrain = !isBelowTerrain(t);
        } else if (isBelowTerrain(t)) {
            let lo = previousT;
            let hi = t;
            for (let j = 0; j < MAX_BISECTIONS && horizontalLength * (hi - lo) > MERCATOR_BISECT_EPSILON_PX; j++) {
                const mid = (lo + hi) / 2;
                if (isBelowTerrain(mid)) hi = mid;
                else lo = mid;
            }
            const sampleLo = sampleRay(lo);
            const sampleHi = sampleRay(hi);
            const fLo = near[2] + lo * dz - sampleLo.elevation;
            const fHi = near[2] + hi * dz - sampleHi.elevation;
            const hit = sampleLo.covered && fLo > fHi ? clamp(lo + fLo * (hi - lo) / (fLo - fHi), lo, hi) : hi;
            return new MercatorCoordinate(
                (near[0] + hit * dx) / worldSize,
                (near[1] + hit * dy) / worldSize,
                sampleRay(hit).elevation);
        }

        previousT = t;
    }

    return null;
}

function globeSampleAt(index: CoverageIndex, exaggeration: number, position: vec3): {sample: TerrainSample; radius: number; mercator: MercatorCoordinate} {
    const radius = vec3.length(position);
    const surface = createVec3f64();
    vec3.scale(surface, position, 1 / radius);
    const lngLat = sphereSurfacePointToCoordinates(surface);
    const projected = MercatorCoordinate.fromLngLat(lngLat);
    const mercator = new MercatorCoordinate(projected.x, clamp(projected.y, 0, MAX_MERCATOR_Y));
    const sample = sampleAt(index, exaggeration, mercator.x, mercator.y);
    // The globe mesh caps the poles at elevation zero, matching the GLOBE branch of get_elevation.
    const elevation = Math.abs(lngLat.lat) > MAX_VALID_LATITUDE ? 0 : sample.elevation;
    return {sample: {covered: sample.covered, elevation}, radius, mercator};
}

/**
 * Intersects the ray through a screen pixel with the rendered terrain surface under a globe transform.
 * @param transform - the transform the terrain is rendered with
 * @param terrain - the terrain
 * @param p - screen coordinate
 * @returns the mercator coordinate of the nearest hit with z in meters, or null when the ray misses the terrain
 */
export function raycastTerrainGlobe(transform: IReadonlyTransform, terrain: Terrain, p: Point): MercatorCoordinate | null {
    const index = buildCoverageIndex(terrain);
    if (!index) return null;

    const origin = transform.cameraPosition;
    const direction = transform.getRayDirectionFromPixel(p);
    const outer = raySphereIntersection(origin, direction, 1 + index.maxElevation / earthRadius);
    if (!outer) return null;
    const inner = raySphereIntersection(origin, direction, 1 + index.minElevation / earthRadius);

    const tStart = Math.max(outer.tMin, 0);
    const tEnd = inner ? inner.tMin : outer.tMax;
    if (tEnd <= tStart) return null;

    const positionAt = (t: number): vec3 => {
        const position = createVec3f64();
        vec3.scaleAndAdd(position, origin, direction, t);
        return position;
    };
    const isBelowTerrain = (t: number) => {
        const {sample, radius} = globeSampleAt(index, terrain.exaggeration, positionAt(t));
        return sample.covered && (radius - 1) * earthRadius <= sample.elevation + HIT_EPSILON_M;
    };

    let previousT = 0;
    for (let i = 0; i <= GLOBE_SAMPLES; i++) {
        const t = tStart + (tEnd - tStart) * i / GLOBE_SAMPLES;
        if (isBelowTerrain(t)) {
            let lo = previousT;
            let hi = t;
            for (let j = 0; j < MAX_BISECTIONS && hi - lo > GLOBE_BISECT_EPSILON_T; j++) {
                const mid = (lo + hi) / 2;
                if (isBelowTerrain(mid)) hi = mid;
                else lo = mid;
            }
            const {sample, mercator} = globeSampleAt(index, terrain.exaggeration, positionAt(hi));
            return new MercatorCoordinate(mercator.x, mercator.y, sample.elevation);
        }
        previousT = t;
    }

    return null;
}

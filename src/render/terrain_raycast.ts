import {vec3} from 'gl-matrix';
import {EXTENT} from '../data/extent.ts';
import {earthRadius} from '../geo/lng_lat.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {raySphereIntersection, sphereSurfacePointToCoordinates} from '../geo/projection/globe_utils.ts';
import {clamp, createVec3f64, MAX_VALID_LATITUDE} from '../util/util.ts';
import type Point from '@mapbox/point-geometry';
import type {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {Terrain, TerrainElevationSampler} from './terrain.ts';

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

type TerrainSample = {
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
function sampleAt(index: TerrainCoverageIndex, exaggeration: number, mercatorX: number, mercatorY: number): TerrainSample {
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

type MercatorRay = {
    index: TerrainCoverageIndex;
    exaggeration: number;
    near: vec3;
    dx: number;
    dy: number;
    dz: number;
    worldSize: number;
};

function mercatorSampleAt(ray: MercatorRay, t: number): TerrainSample {
    return sampleAt(ray.index, ray.exaggeration, (ray.near[0] + t * ray.dx) / ray.worldSize, (ray.near[1] + t * ray.dy) / ray.worldSize);
}

function mercatorIsBelowTerrain(ray: MercatorRay, t: number): boolean {
    const sample = mercatorSampleAt(ray, t);
    return sample.covered && ray.near[2] + t * ray.dz <= sample.elevation + HIT_EPSILON_M;
}

/**
 * Narrows the bracket `[lo, hi]` around the surface crossing until it is shorter than `tolerance` in ray parameter units.
 */
function bisect<Ray>(ray: Ray, isBelowTerrain: (ray: Ray, t: number) => boolean, lo: number, hi: number, tolerance: number): {lo: number; hi: number} {
    for (let j = 0; j < MAX_BISECTIONS && hi - lo > tolerance; j++) {
        const mid = (lo + hi) / 2;
        if (isBelowTerrain(ray, mid)) hi = mid;
        else lo = mid;
    }
    return {lo, hi};
}

/**
 * Intersects the ray through a screen pixel with the rendered terrain surface under a mercator transform.
 * @param transform - the transform the terrain is rendered with
 * @param terrain - the terrain
 * @param p - screen coordinate
 * @returns the mercator coordinate of the nearest hit with z in meters, or null when the ray misses the terrain
 */
export function raycastTerrainMercator(transform: MercatorTransform, terrain: Terrain, p: Point): MercatorCoordinate | null {
    const index = terrain.getCoverageIndex();
    if (!index) return null;

    const {near, far} = transform.getRaySegmentFromPixel(p);
    const worldSize = transform.worldSize;
    const dx = far[0] - near[0];
    const dy = far[1] - near[1];
    const dz = far[2] - near[2];
    const ray: MercatorRay = {index, exaggeration: terrain.exaggeration, near, dx, dy, dz, worldSize};

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

    let previousT = 0;
    let aboveTerrain = !mercatorIsBelowTerrain(ray, 0);

    for (let i = 0; i <= samples; i++) {
        const t = tStart + (tEnd - tStart) * i / samples;

        if (!aboveTerrain) {
            aboveTerrain = !mercatorIsBelowTerrain(ray, t);
        } else if (mercatorIsBelowTerrain(ray, t)) {
            const {lo, hi} = bisect(ray, mercatorIsBelowTerrain, previousT, t, MERCATOR_BISECT_EPSILON_PX / horizontalLength);
            const sampleLo = mercatorSampleAt(ray, lo);
            const sampleHi = mercatorSampleAt(ray, hi);
            const fLo = near[2] + lo * dz - sampleLo.elevation;
            const fHi = near[2] + hi * dz - sampleHi.elevation;
            const hit = sampleLo.covered && fLo > fHi ? clamp(lo + fLo * (hi - lo) / (fLo - fHi), lo, hi) : hi;
            return new MercatorCoordinate(
                (near[0] + hit * dx) / worldSize,
                (near[1] + hit * dy) / worldSize,
                mercatorSampleAt(ray, hit).elevation);
        }

        previousT = t;
    }

    return null;
}

type GlobeRay = {
    index: TerrainCoverageIndex;
    exaggeration: number;
    origin: vec3;
    direction: vec3;
};

function globeSampleAt(ray: GlobeRay, t: number): {sample: TerrainSample; radius: number; mercator: MercatorCoordinate} {
    const position = createVec3f64();
    vec3.scaleAndAdd(position, ray.origin, ray.direction, t);
    const radius = vec3.length(position);
    const surface = createVec3f64();
    vec3.scale(surface, position, 1 / radius);
    const lngLat = sphereSurfacePointToCoordinates(surface);
    const projected = MercatorCoordinate.fromLngLat(lngLat);
    const mercator = new MercatorCoordinate(projected.x, clamp(projected.y, 0, MAX_MERCATOR_Y));
    const sample = sampleAt(ray.index, ray.exaggeration, mercator.x, mercator.y);
    // The globe mesh caps the poles at elevation zero, matching the GLOBE branch of get_elevation.
    const elevation = Math.abs(lngLat.lat) > MAX_VALID_LATITUDE ? 0 : sample.elevation;
    return {sample: {covered: sample.covered, elevation}, radius, mercator};
}

function globeIsBelowTerrain(ray: GlobeRay, t: number): boolean {
    const {sample, radius} = globeSampleAt(ray, t);
    return sample.covered && (radius - 1) * earthRadius <= sample.elevation + HIT_EPSILON_M;
}

/**
 * Intersects the ray through a screen pixel with the rendered terrain surface under a globe transform.
 * @param transform - the transform the terrain is rendered with
 * @param terrain - the terrain
 * @param p - screen coordinate
 * @returns the mercator coordinate of the nearest hit with z in meters, or null when the ray misses the terrain
 */
export function raycastTerrainGlobe(transform: IReadonlyTransform, terrain: Terrain, p: Point): MercatorCoordinate | null {
    const index = terrain.getCoverageIndex();
    if (!index) return null;

    const origin = transform.cameraPosition;
    const direction = transform.getRayDirectionFromPixel(p);
    const outer = raySphereIntersection(origin, direction, 1 + index.maxElevation / earthRadius);
    if (!outer) return null;
    const inner = raySphereIntersection(origin, direction, 1 + index.minElevation / earthRadius);

    const tStart = Math.max(outer.tMin, 0);
    const tEnd = inner ? inner.tMin : outer.tMax;
    if (tEnd <= tStart) return null;

    const ray: GlobeRay = {index, exaggeration: terrain.exaggeration, origin, direction};

    let previousT = 0;
    for (let i = 0; i <= GLOBE_SAMPLES; i++) {
        const t = tStart + (tEnd - tStart) * i / GLOBE_SAMPLES;
        if (globeIsBelowTerrain(ray, t)) {
            const {hi} = bisect(ray, globeIsBelowTerrain, previousT, t, GLOBE_BISECT_EPSILON_T);
            const {sample, mercator} = globeSampleAt(ray, hi);
            return new MercatorCoordinate(mercator.x, mercator.y, sample.elevation);
        }
        previousT = t;
    }

    return null;
}

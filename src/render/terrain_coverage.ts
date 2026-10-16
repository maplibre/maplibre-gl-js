import {EXTENT} from '../data/extent.ts';
import {mercatorWorldCoordinateHelper} from '../geo/mercator_coordinate.ts';

import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {LngLat} from '../geo/lng_lat.ts';
import type {TerrainTileManager} from '../tile/terrain_tile_manager.ts';
import type {WorldCoordinateHelper} from '../geo/transform_interface.ts';

export type TerrainElevationSampler = (x: number, y: number, extent: number) => number;

const MAX_BISECTIONS = 40;
const HIT_EPSILON_M = 1e-6;
/**
 * @internal
 * The last fraction of the camera-to-location distance within which a terrain hit does not count for
 * {@link ITransform.isLocationOccluded}, so the terrain the location sits on never hides it.
 */
export const TERRAIN_OCCLUSION_MARGIN = 0.01;
/** Keeps the elevation bracket non-degenerate when the terrain is entirely flat, such as unloaded DEMs. */
const BRACKET_PADDING_M = 10;
/** Tile coordinates run from 0 up to but not including `EXTENT`; a point on the far edge is clamped back into the tile. */
const MAX_TILE_COORD = EXTENT * (1 - 1e-12);

/**
 * Offset, in DEM pixels, from a tile coordinate scaled by `dim` to the pixel index `DEMData.sampleBilinear` expects.
 * DEM pixel `i` describes the cell centred at tile coordinate `(i + 0.5) / dim`, the same placement hillshade and
 * color-relief use, so a sample between two cell centres interpolates the pixels on either side of it.
 */
const DEM_CELL_CENTER_OFFSET = -0.5;

export type TerrainSample = {
    covered: boolean;
    /** Whether the elevation comes from loaded DEM data rather than the flat surface rendered while it loads. */
    demLoaded: boolean;
    elevation: number;
};

export type TerrainCoverageIndex = {
    zooms: number[];
    samplerPerTile: Map<string, TerrainElevationSampler | null>;
    minElevation: number;
    maxElevation: number;
};

const NOT_COVERED: TerrainSample = {covered: false, demLoaded: false, elevation: 0};

/**
 * The drawn terrain tiles' DEM data as sampled on the CPU: an index of their elevation samplers, built on first use
 * and kept until {@link reset} (the renderable tile set changed, or the terrain source), in two views: every drawn
 * tile's DEM data, a loaded parent's where the tile's own has not loaded, or only the tiles' own.
 * @param tileManager - the terrain source's tiles, drawn and loaded
 * @param exaggeration - the terrain's exaggeration, which every sampled elevation includes
 * @param getWorldCoordinateHelper - the lng/lat to world mapping of the map's projection, mercator by default
 */
export class TerrainCoverage {
    private _samplerCache = new Map<string, TerrainElevationSampler>();
    /** undefined means not built yet; null that no terrain tile is renderable. */
    private _index: TerrainCoverageIndex | null | undefined;
    private _ownDemIndex: TerrainCoverageIndex | null | undefined;

    constructor(
        private readonly tileManager: TerrainTileManager,
        private readonly exaggeration: number,
        private readonly getWorldCoordinateHelper: () => WorldCoordinateHelper = () => mercatorWorldCoordinateHelper
    ) {}

    /** Drops the samplers and both indexes. Missing DEM data is never cached, so a later sample can retry. */
    reset(): void {
        this._samplerCache.clear();
        this._index = undefined;
        this._ownDemIndex = undefined;
    }

    /**
     * @param ownDemOnly - whether a tile whose own DEM data has not loaded has none, though a loaded parent's is drawn
     * in its place
     * @returns the index, or null when no terrain tile is renderable
     */
    getIndex(ownDemOnly: boolean = false): TerrainCoverageIndex | null {
        if (ownDemOnly) {
            if (this._ownDemIndex === undefined) this._ownDemIndex = this._build(true);
            return this._ownDemIndex;
        }
        if (this._index === undefined) this._index = this._build(false);
        return this._index;
    }

    /**
     * The elevation the drawn tiles' DEM data gives at a location, in respect of exaggeration, or undefined where no
     * drawn tile has that data.
     */
    sample(lnglat: LngLat, ownDemOnly: boolean = false): number | undefined {
        const index = this.getIndex(ownDemOnly);
        if (!index) return undefined;
        const worldCoordinateHelper = this.getWorldCoordinateHelper();
        const {x, y} = worldCoordinateHelper.worldFromLngLat(lnglat.lng, lnglat.lat);
        const sample = sampleAt(index, this.exaggeration, x, y, worldCoordinateHelper.wraps);
        return sample.demLoaded ? sample.elevation : undefined;
    }

    /** The cached sampler of a tile's raw DEM elevation, or null when its DEM data is not loaded. */
    getSampler(tileID: OverscaledTileID): TerrainElevationSampler | null {
        const key = tileID.key;
        const cachedSampler = this._samplerCache.get(key);
        if (cachedSampler) return cachedSampler;
        const sampler = this._createElevationSampler(tileID);
        if (sampler) this._samplerCache.set(key, sampler);
        return sampler;
    }

    /**
     * A function that samples a tile's raw DEM elevation, without exaggeration, or null when the tile's DEM data is
     * not loaded. The DEM tile is the tile's own or a loaded parent's, so the tile's coordinates are scaled and offset
     * into it, as {@link Terrain._getDEMTileMatrix} does for the renderer; the sampler places DEM pixels at cell
     * centres, matching `get_elevation` in the vertex shader prelude.
     */
    private _createElevationSampler(tileID: OverscaledTileID): TerrainElevationSampler | null {
        const sourceTile = this.tileManager.getSourceTile(tileID, true);
        const dem = sourceTile?.dem;
        if (!sourceTile || !dem) return null;

        const dz = tileID.canonical.z - sourceTile.tileID.canonical.z;
        const tilesPerDemTile = 1 << dz;
        // Store the vector-tile to DEM-pixel transform once for the hot sampling loop.
        const demPixelScale = dem.dim / (EXTENT * tilesPerDemTile);
        const demPixelOffsetX = (tileID.canonical.x - (tileID.canonical.x >> dz << dz)) / tilesPerDemTile * dem.dim + DEM_CELL_CENTER_OFFSET;
        const demPixelOffsetY = (tileID.canonical.y - (tileID.canonical.y >> dz << dz)) / tilesPerDemTile * dem.dim + DEM_CELL_CENTER_OFFSET;
        return (x: number, y: number, extent: number): number => {
            const extentScale = extent === EXTENT ? 1 : EXTENT / extent;
            return dem.sampleBilinear(
                x * extentScale * demPixelScale + demPixelOffsetX,
                y * extentScale * demPixelScale + demPixelOffsetY
            );
        };
    }

    private _build(ownDemOnly: boolean): TerrainCoverageIndex | null {
        const {tileManager} = this;
        const zooms: number[] = [];
        const samplerPerTile = new Map<string, TerrainElevationSampler | null>();
        let minElevation = 0;
        let maxElevation = 0;

        for (const tile of tileManager.getRenderableTiles()) {
            if (!tile) continue;
            const {canonical, wrap} = tile.tileID;
            if (!zooms.includes(canonical.z)) zooms.push(canonical.z);
            const sampler = ownDemOnly && !tileManager.getSourceTile(tile.tileID)?.dem ? null : this.getSampler(tile.tileID);
            samplerPerTile.set(`${wrap}/${canonical.z}/${canonical.x}/${canonical.y}`, sampler);
            const dem = tileManager.getSourceTile(tile.tileID, true)?.dem;
            minElevation = Math.min(minElevation, (dem?.min ?? 0) * this.exaggeration);
            maxElevation = Math.max(maxElevation, (dem?.max ?? 0) * this.exaggeration);
        }

        if (samplerPerTile.size === 0) return null;
        zooms.sort((a, b) => b - a);
        return {zooms, samplerPerTile, minElevation: minElevation - BRACKET_PADDING_M, maxElevation: maxElevation + BRACKET_PADDING_M};
    }
}

/**
 * Elevation of the rendered terrain surface at a world position, and whether it is covered at all.
 * A covered tile whose DEM has not loaded yet is flat at zero, which is what the terrain mesh renders.
 * @param wraps - whether x wraps into world copies (mercator); a planar CRS has no terrain outside its world square
 */
export function sampleAt(index: TerrainCoverageIndex, exaggeration: number, worldX: number, worldY: number, wraps: boolean): TerrainSample {
    if (worldY < 0 || worldY >= 1) return NOT_COVERED;
    if (!wraps && (worldX < 0 || worldX >= 1)) return NOT_COVERED;
    const wrap = wraps ? Math.floor(worldX) : 0;
    const wrappedX = worldX - wrap;

    for (const z of index.zooms) {
        const scale = 1 << z;
        const scaledX = wrappedX * scale;
        const scaledY = worldY * scale;
        const tileX = Math.floor(scaledX);
        const tileY = Math.floor(scaledY);
        const key = `${wrap}/${z}/${tileX}/${tileY}`;
        if (!index.samplerPerTile.has(key)) continue;
        const sampler = index.samplerPerTile.get(key);
        if (!sampler) return {covered: true, demLoaded: false, elevation: 0};
        const x = Math.min((scaledX - tileX) * EXTENT, MAX_TILE_COORD);
        const y = Math.min((scaledY - tileY) * EXTENT, MAX_TILE_COORD);
        return {covered: true, demLoaded: true, elevation: sampler(x, y, EXTENT) * exaggeration};
    }
    return NOT_COVERED;
}

/**
 * Whether a height in meters is at or below the sampled terrain surface.
 * The epsilon absorbs rounding when a bracket endpoint lands exactly on the surface.
 */
export function isBelowTerrainSample(sample: TerrainSample, height: number): boolean {
    return sample.covered && height <= sample.elevation + HIT_EPSILON_M;
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

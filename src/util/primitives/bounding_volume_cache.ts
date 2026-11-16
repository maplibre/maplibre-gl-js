import {OverscaledTileID} from '../../tile/tile_id.ts';

import type {CoveringTilesOptionsInternal} from '../../geo/projection/covering_tiles.ts';
import type {IBoundingVolume} from './bounding_volume.ts';

type BoundingVolumeFactory<T extends IBoundingVolume> = (tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal) => T;

/**
 * The key of a tile's bounding volume: what the volume is computed from. The elevation is rounded, so that sub-meter
 * changes do not defeat the cache, see `getElevationForTileCulling`. Over terrain the volume spans the tile's lowest
 * and highest elevation, which change as the tile's DEM data lands, so they are part of the key.
 */
function boundingVolumeKey(tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal): string {
    const key = `${tileID.z}_${tileID.x}_${tileID.y}_${Math.round(elevation)}`;
    if (!options?.terrain) return key;
    const {minElevation, maxElevation} = options.terrain.getMinMaxElevation(new OverscaledTileID(tileID.z, wrap, tileID.z, tileID.x, tileID.y));
    return `${key}_${minElevation}_${maxElevation}`;
}

/**
 * Keeps the bounding volumes computed for tiles, by what each was computed from, see {@link boundingVolumeKey}. A volume
 * depends on nothing else, so the cache is shared by every map, and it drops the volume used longest ago once it holds
 * more than its capacity.
 */
export class BoundingVolumeCache<T extends IBoundingVolume> {
    /** The volumes by key, in the order they were last used, the one used longest ago first. */
    private readonly _volumes: Map<string, T> = new Map();
    private readonly _capacity: number;
    private readonly _boundingVolumeFactory: BoundingVolumeFactory<T>;

    /**
     * @param boundingVolumeFactory - computes a tile's bounding volume
     * @param capacity - how many volumes the cache holds, a few frames' worth of tiles
     */
    constructor(boundingVolumeFactory: BoundingVolumeFactory<T>, capacity: number = 4096) {
        this._boundingVolumeFactory = boundingVolumeFactory;
        this._capacity = capacity;
    }

    /** Returns the bounding volume of a tile, computing it with the factory where the cache does not hold it. */
    getTileBoundingVolume(tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal): T {
        const key = boundingVolumeKey(tileID, wrap, elevation, options);
        let volume = this._volumes.get(key);
        if (volume) {
            this._volumes.delete(key);
        } else {
            volume = this._boundingVolumeFactory(tileID, wrap, elevation, options);
            if (this._volumes.size >= this._capacity) this._volumes.delete(this._volumes.keys().next().value);
        }
        this._volumes.set(key, volume);
        return volume;
    }
}

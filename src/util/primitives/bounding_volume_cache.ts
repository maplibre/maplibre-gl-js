import type {CoveringTilesOptionsInternal} from '../../geo/projection/covering_tiles.ts';
import type {IBoundingVolume} from './bounding_volume.ts';

type BoundingVolumeFactory<T extends IBoundingVolume> = (tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal) => T;

/**
 * The key of a tile's bounding volume: the tile, whether it is drawn over terrain, and its elevation. The elevation is
 * rounded, so that sub-meter changes do not defeat the cache, see `getElevationForTileCulling`. A volume over terrain
 * spans the tile's lowest and highest elevation, which the key does not hold, so it keeps the elevations it was
 * computed with until it drops out of the cache.
 */
function boundingVolumeKey(tileID: {x: number; y: number; z: number}, elevation: number, options: CoveringTilesOptionsInternal): string {
    return `${tileID.z}_${tileID.x}_${tileID.y}_${options?.terrain ? 't' : ''}_${Math.round(elevation)}`;
}

/**
 * Keeps the bounding volumes computed for tiles, by their {@link boundingVolumeKey}. The cache is shared by every map,
 * and it drops the volume used longest ago once it holds more than its capacity.
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
        const key = boundingVolumeKey(tileID, elevation, options);
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

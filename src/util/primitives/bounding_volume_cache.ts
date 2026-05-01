import {type CoveringTilesOptionsInternal} from '../../geo/projection/covering_tiles';
import {type IBoundingVolume} from './bounding_volume';

type BoundingVolumeFactory<T extends IBoundingVolume> = (tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal) => T;

export class BoundingVolumeCache<T extends IBoundingVolume> {
    private _cachePrevious: Map<string, T> = new Map();
    private _cache: Map<string, T> = new Map();
    private _hadAnyChanges = false;
    private _boundingVolumeFactory: BoundingVolumeFactory<T>;

    constructor(boundingVolumeFactory: BoundingVolumeFactory<T>) {
        this._boundingVolumeFactory = boundingVolumeFactory;
    }

    /**
     * Prepares bounding volume cache for next frame. Call at the beginning of a frame.
     * Bounding volume of any tile accesses in the last frame is kept in the cache, other (unaccessed) bounding volumes are deleted.
     */
    swapBuffers() {
        if (!this._hadAnyChanges) {
            // If no new bounding volumes were added this frame, no need to conserve memory, do not clear caches.
            return;
        }
        const oldCache = this._cachePrevious;
        this._cachePrevious = this._cache;
        this._cache = oldCache;
        this._cache.clear();
        this._hadAnyChanges = false;
    }

    /**
     * Returns the bounding volume of the specified tile, fetching it from cache or creating it using the factory function if needed.
     * @param tileID - Tile x, y and z for zoom.
     */
    getTileBoundingVolume(tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal): T {
        const key = `${tileID.z}_${tileID.x}_${tileID.y}_${options?.terrain ? 't' : ''}`;
        const cached = this._cache.get(key);
        if (cached) {
            return cached;
        }
        const cachedPrevious = this._cachePrevious.get(key);
        if (cachedPrevious) {
            this._cache.set(key, cachedPrevious);
            return cachedPrevious;
        }
        const boundingVolume = this._boundingVolumeFactory(tileID, wrap, elevation, options);
        this._cache.set(key, boundingVolume);
        this._hadAnyChanges = true;
        return boundingVolume;
    }
}

import {type CoveringTilesOptions} from '../../geo/projection/covering_tiles';
import {type Aabb} from './aabb';

type AabbFactory = (tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptions) => Aabb;

export class AabbCache {
    private _cachePrevious: Map<string, Aabb> = new Map();
    private _cache: Map<string, Aabb> = new Map();
    private _hadAnyChanges = false;
    private _aabbFactory: AabbFactory;

    constructor(aabbFactory: AabbFactory) {
        this._aabbFactory = aabbFactory;
    }

    /**
     * Prepares AABB cache for next frame. Call at the beginning of a frame.
     * Any tile accesses in the last frame is kept in the cache, other tiles are deleted.
     * @returns 
     */
    recalculateCache() {
        if (!this._hadAnyChanges) {
            // If no new boxes were added this frame, no need to conserve memory, do not clear caches.
            return;
        }
        const oldCache = this._cachePrevious;
        this._cachePrevious = this._cache;
        this._cache = oldCache;
        this._cache.clear();
        this._hadAnyChanges = false;
    }

    /**
     * Returns the AABB of the specified tile, fetching it from cache or creating it using the factory function if needed.
     * @param tileID - Tile x, y and z for zoom.
     */
    getTileAABB(tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptions): Aabb {
        const key = `${tileID.z}_${tileID.x}_${tileID.y}`;
        const cached = this._cache.get(key);
        if (cached) {
            return cached;
        }
        const cachedPrevious = this._cachePrevious.get(key);
        if (cachedPrevious) {
            this._cache.set(key, cachedPrevious);
            return cachedPrevious;
        }
        const aabb = this._aabbFactory(tileID, wrap, elevation, options);
        this._cache.set(key, aabb);
        this._hadAnyChanges = true;
        return aabb;
    }
}

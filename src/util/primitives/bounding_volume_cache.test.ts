import {expect, test, vi} from 'vitest';
import {BoundingVolumeCache} from './bounding_volume_cache.ts';
import {Aabb} from './aabb.ts';

import type {CoveringTilesOptionsInternal} from '../../geo/projection/covering_tiles.ts';

/** A bounding volume factory that makes a fresh box per call, so that a cached volume is told apart by reference. */
function createFactory() {
    return vi.fn(() => new Aabb([0, 0, 0], [1, 1, 1]));
}

function tile(x: number): {x: number; y: number; z: number} {
    return {x, y: 0, z: 1};
}

test('returns the volume it computed for a tile while it holds it', () => {
    const factory = createFactory();
    const cache = new BoundingVolumeCache(factory);

    const first = cache.getTileBoundingVolume(tile(0), 0, 0, null);
    const second = cache.getTileBoundingVolume(tile(0), 0, 0, null);

    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
});

test('drops the volume used longest ago once it holds more than its capacity', () => {
    const factory = createFactory();
    const cache = new BoundingVolumeCache(factory, 2);
    const first = cache.getTileBoundingVolume(tile(0), 0, 0, null);
    cache.getTileBoundingVolume(tile(1), 0, 0, null);
    cache.getTileBoundingVolume(tile(0), 0, 0, null);

    cache.getTileBoundingVolume(tile(2), 0, 0, null);

    expect(cache.getTileBoundingVolume(tile(0), 0, 0, null)).toBe(first);
    expect(factory).toHaveBeenCalledTimes(3);
    cache.getTileBoundingVolume(tile(1), 0, 0, null);
    expect(factory).toHaveBeenCalledTimes(4);
});

test('computes the volume again when the terrain under the tile changes', () => {
    const factory = createFactory();
    const cache = new BoundingVolumeCache(factory);
    const dem: {minElevation?: number; maxElevation?: number} = {};
    const options = {tileSize: 512, terrain: {getMinMaxElevation: () => ({...dem})}} as unknown as CoveringTilesOptionsInternal;
    const beforeDem = cache.getTileBoundingVolume(tile(0), 0, 0, options);

    dem.minElevation = 0;
    dem.maxElevation = 4000;

    expect(cache.getTileBoundingVolume(tile(0), 0, 0, options)).not.toBe(beforeDem);
});

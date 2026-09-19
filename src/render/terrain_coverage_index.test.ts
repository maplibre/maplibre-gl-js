import {describe, test, expect} from 'vitest';
import {createTerrainCoverageIndex, sampleAt, type TerrainElevationSampler} from './terrain.ts';

// A sampler that reports which tile answered, so a test can tell a parent from its child.
const tagged = (tag: number): TerrainElevationSampler => () => tag;

describe('TerrainCoverageIndex', () => {
    test('returns null without tiles', () => {
        expect(createTerrainCoverageIndex([], 0, 0)).toBeNull();
    });

    test('finest covering tile answers, also after the fast path cached its parent', () => {
        // parent 2/1/1 and one of its children 3/2/2 are both renderable (a child that loaded
        // while its siblings still load)
        const index = createTerrainCoverageIndex([
            {wrap: 0, z: 2, x: 1, y: 1, sampler: tagged(20)},
            {wrap: 0, z: 3, x: 2, y: 2, sampler: tagged(30)},
        ], 0, 100);
        // a point in the parent but outside the child
        expect(sampleAt(index, 1, 0.45, 0.45).elevation).toBe(20);
        // then a point inside the child: must not be answered by the parent from the cache
        expect(sampleAt(index, 1, 0.26, 0.26).elevation).toBe(30);
        expect(sampleAt(index, 1, 0.45, 0.45).elevation).toBe(20);
    });

    test('same-tile fast path gives the same answer as a cold lookup', () => {
        const tiles = [];
        for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) tiles.push({wrap: 0, z: 3, x, y, sampler: tagged(x * 8 + y)});
        const warm = createTerrainCoverageIndex(tiles, 0, 100);
        for (let i = 0; i < 1000; i++) {
            const mx = (i * 0.618) % 1, my = (i * 0.414) % 1;
            const cold = createTerrainCoverageIndex(tiles, 0, 100);
            expect(sampleAt(warm, 1, mx, my)).toEqual(sampleAt(cold, 1, mx, my));
        }
    });

    test('wraps are kept apart', () => {
        const index = createTerrainCoverageIndex([
            {wrap: 0, z: 1, x: 0, y: 0, sampler: tagged(1)},
            {wrap: 1, z: 1, x: 0, y: 0, sampler: tagged(2)},
        ], 0, 100);
        expect(sampleAt(index, 1, 0.25, 0.25).elevation).toBe(1);
        expect(sampleAt(index, 1, 1.25, 0.25).elevation).toBe(2);
        expect(sampleAt(index, 1, 0.25, 0.25).elevation).toBe(1);
        expect(sampleAt(index, 1, 2.25, 0.25).covered).toBe(false);
    });

    test('a tile whose DEM is loading is covered but flat', () => {
        const index = createTerrainCoverageIndex([{wrap: 0, z: 0, x: 0, y: 0, sampler: null}], 0, 0);
        expect(sampleAt(index, 1, 0.5, 0.5)).toEqual({covered: true, demLoaded: false, elevation: 0});
        expect(sampleAt(index, 1, 0.5, 0.5)).toEqual({covered: true, demLoaded: false, elevation: 0});
    });

    test('exaggeration scales both paths', () => {
        const index = createTerrainCoverageIndex([{wrap: 0, z: 0, x: 0, y: 0, sampler: tagged(10)}], 0, 10);
        expect(sampleAt(index, 2, 0.5, 0.5).elevation).toBe(20);
        expect(sampleAt(index, 3, 0.5, 0.5).elevation).toBe(30);
    });

    test('elevation bracket is padded', () => {
        const index = createTerrainCoverageIndex([{wrap: 0, z: 0, x: 0, y: 0, sampler: null}], -5, 50);
        expect(index.minElevation).toBeLessThan(-5);
        expect(index.maxElevation).toBeGreaterThan(50);
    });
});

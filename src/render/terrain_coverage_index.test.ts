import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {createTerrainCoverageIndex, sampleAt, skipAboveTerrain, type TerrainElevationSampler} from './terrain.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {coveringTiles} from '../geo/projection/covering_tiles.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {createDEM, createDEMTerrain} from '../util/test/util.ts';

import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {Tile} from '../tile/tile.ts';

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

describe('skipAboveTerrain', () => {
    // one z0 tile covering the world, max 100 m; the ray starts at t=0 at (x=128, y=256) world px,
    // 1000 m up, moving +x and down 10 m per unit of t, in a world of 512 px
    const index = createTerrainCoverageIndex([{wrap: 0, z: 1, x: 0, y: 0, sampler: () => 50, maxElevation: 100}], 0, 100);

    test('skips to where the ray reaches the tile top', () => {
        sampleAt(index, 1, 0.1, 0.1);             // sets index.last to tile 1/0/0
        // top = 100 + 1 m margin; z(t) = 1000 - 10 t reaches 101 at t = 89.9; the tile edge x=256 at t=128
        expect(skipAboveTerrain(index, [100, 100, 1000], 1, 0, -10, 512, 0, 1)).toBeCloseTo(89.9, 6);
    });

    test('skips to the tile edge when that comes first', () => {
        sampleAt(index, 1, 0.1, 0.1);
        expect(skipAboveTerrain(index, [100, 100, 1000], 10, 0, -1, 512, 0, 1)).toBeCloseTo(15.6, 6);
    });

    test('no skip below the tile top, outside the tile, or for an unknown bound', () => {
        sampleAt(index, 1, 0.1, 0.1);
        expect(skipAboveTerrain(index, [100, 100, 50], 1, 0, -1, 512, 0, 1)).toBe(0);
        expect(skipAboveTerrain(index, [300, 100, 1000], 1, 0, -1, 512, 0, 1)).toBe(0);
        const unknown = createTerrainCoverageIndex([{wrap: 0, z: 1, x: 0, y: 0, sampler: () => 50}], 0, 100);
        sampleAt(unknown, 1, 0.1, 0.1);
        expect(skipAboveTerrain(unknown, [100, 100, 1000], 1, 0, -1, 512, 0, 1)).toBe(0);
    });

    test('exaggeration raises the tile top', () => {
        sampleAt(index, 2, 0.1, 0.1);
        // top = 2 * 100 + 1 = 201: z(t) = 1000 - 10 t reaches it at t = 79.9
        expect(skipAboveTerrain(index, [100, 100, 1000], 1, 0, -10, 512, 0, 2)).toBeCloseTo(79.9, 6);
    });
});

describe('raycast with empty-space skipping', () => {
    test('hits exactly what the unskipped march hits, over sea and mountain tiles', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(640, 400);
        transform.setCenter(new LngLat(-25.1138, 72.87232));
        transform.setZoom(13.59);
        const sea = createDEM(() => 0, 64), peak = createDEM((x, y) => 900 + 600 * Math.sin(x / 7) * Math.cos(y / 11), 64);
        for (const pitch of [45, 70, 80]) {
            transform.setPitch(pitch);
            const tiles = coveringTiles(transform, {tileSize: 256, minzoom: 4, maxzoom: 15});
            const demOf = (id: OverscaledTileID) => ((id.canonical.x * 7 + id.canonical.y * 3) % 4 === 0 ? peak : sea);
            const terrain = createDEMTerrain(tiles, sea);
            terrain.tileManager.getSourceTile = (tileID) => ({tileID, dem: demOf(tileID)}) as Tile;
            const skipping = terrain.getCoverageIndex();
            // the same tiles and samplers, but no elevation bound: nothing can be skipped
            const plain = {...skipping, last: null,
                tiles: skipping.tiles.map(byWrap => new Map([...byWrap].map(([w, m]) =>
                    [w, new Map([...m].map(([k, t]) => [k, {...t, maxElevation: Infinity}]))])))};
            for (let iy = 0; iy <= 10; iy++) for (let ix = 0; ix <= 16; ix++) {
                const p = new Point(640 * ix / 16, 400 * iy / 10);
                terrain.getCoverageIndex = () => skipping;
                const a = transform.screenTerrainPointToMercatorCoordinate(p, terrain);
                terrain.getCoverageIndex = () => plain;
                const b = transform.screenTerrainPointToMercatorCoordinate(p, terrain);
                // same hit/miss, and the same point to 1e-9 of the world (sub-millimetre)
                const diff = a && b ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : (a === b ? 0 : 1);
                expect(diff).toBeLessThan(1e-9);
            }
        }
    });
});

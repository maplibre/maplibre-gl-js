import {describe, test, expect} from 'vitest';
import {CanonicalTileID} from '../../tile/tile_id';
import {EXTENT} from '../extent';
import {createIsAntimeridianEdge} from './antimeridian_bucket_features';

describe('createIsAntimeridianEdge', () => {
    test('returns null for an interior tile', () => {
        expect(createIsAntimeridianEdge(new CanonicalTileID(2, 1, 1))).toBeNull();
        expect(createIsAntimeridianEdge(new CanonicalTileID(2, 2, 1))).toBeNull();
    });

    test('left-edge tile (x === 0) flags x=0 edges only', () => {
        const isEdge = createIsAntimeridianEdge(new CanonicalTileID(2, 0, 1));
        expect(isEdge).not.toBeNull();
        expect(isEdge(0, 0)).toBe(true);
        expect(isEdge(0, 10)).toBe(false);
        expect(isEdge(10, 0)).toBe(false);
        expect(isEdge(EXTENT, EXTENT)).toBe(false);
    });

    test('right-edge tile (x === (1<<z) - 1) flags x=EXTENT edges only', () => {
        const isEdge = createIsAntimeridianEdge(new CanonicalTileID(2, 3, 1));
        expect(isEdge).not.toBeNull();
        expect(isEdge(EXTENT, EXTENT)).toBe(true);
        expect(isEdge(EXTENT, 10)).toBe(false);
        expect(isEdge(0, 0)).toBe(false);
    });

    test('zoom 0 tile is both the left and right edge', () => {
        const isEdge = createIsAntimeridianEdge(new CanonicalTileID(0, 0, 0));
        expect(isEdge).not.toBeNull();
        expect(isEdge(0, 0)).toBe(true);
        expect(isEdge(EXTENT, EXTENT)).toBe(true);
        expect(isEdge(0, EXTENT)).toBe(false);
    });
});

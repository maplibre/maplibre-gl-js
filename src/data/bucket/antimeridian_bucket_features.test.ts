import {describe, test, expect} from 'vitest';
import {CanonicalTileID} from '../../tile/tile_id';
import {EXTENT} from '../extent';
import {getAntimeridianEdgePredicate} from './antimeridian_bucket_features';

describe('getAntimeridianEdgePredicate', () => {
    test('returns null for an interior tile', () => {
        expect(getAntimeridianEdgePredicate(new CanonicalTileID(2, 1, 1))).toBeNull();
        expect(getAntimeridianEdgePredicate(new CanonicalTileID(2, 2, 1))).toBeNull();
    });

    test('left-edge tile (x === 0) flags x=0 edges only', () => {
        const pred = getAntimeridianEdgePredicate(new CanonicalTileID(2, 0, 1));
        expect(pred).not.toBeNull();
        expect(pred(0, 0)).toBe(true);
        expect(pred(0, 10)).toBe(false);
        expect(pred(10, 0)).toBe(false);
        expect(pred(EXTENT, EXTENT)).toBe(false);
    });

    test('right-edge tile (x === (1<<z) - 1) flags x=EXTENT edges only', () => {
        const pred = getAntimeridianEdgePredicate(new CanonicalTileID(2, 3, 1));
        expect(pred).not.toBeNull();
        expect(pred(EXTENT, EXTENT)).toBe(true);
        expect(pred(EXTENT, 10)).toBe(false);
        expect(pred(0, 0)).toBe(false);
    });

    test('zoom 0 tile is both the left and right edge', () => {
        const pred = getAntimeridianEdgePredicate(new CanonicalTileID(0, 0, 0));
        expect(pred).not.toBeNull();
        expect(pred(0, 0)).toBe(true);
        expect(pred(EXTENT, EXTENT)).toBe(true);
        expect(pred(0, EXTENT)).toBe(false);
    });
});

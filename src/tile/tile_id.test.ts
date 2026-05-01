import {describe, test, expect} from 'vitest';
import {CanonicalTileID, OverscaledTileID} from './tile_id';
import {EXTENT} from '../data/extent';
import {MAX_TILE_ZOOM, MIN_TILE_ZOOM} from '../util/util';

describe('CanonicalTileID', () => {
    test('constructor', () => {
        expect(() => {
            new CanonicalTileID(MIN_TILE_ZOOM - 1, 0, 0);
        }).toThrow();
        expect(() => {
            new CanonicalTileID(MAX_TILE_ZOOM + 1, 0, 0);
        }).toThrow();
        expect(() => {
            new CanonicalTileID(2, 4, 0);
        }).toThrow();
        expect(() => {
            new CanonicalTileID(2, 0, 4);
        }).toThrow();
    });

    test('.key', () => {
        expect(new CanonicalTileID(0, 0, 0).key).toBe('000');
        expect(new CanonicalTileID(1, 0, 0).key).toBe('011');
        expect(new CanonicalTileID(1, 1, 0).key).toBe('111');
        expect(new CanonicalTileID(1, 1, 1).key).toBe('311');
    });

    test('.equals', () => {
        expect(new CanonicalTileID(3, 2, 1).equals(new CanonicalTileID(3, 2, 1))).toBeTruthy();
        expect(new CanonicalTileID(9, 2, 3).equals(new CanonicalTileID(3, 2, 1))).toBeFalsy();
    });

    test('.url replaces {z}/{x}/{y}', () => {
        expect(new CanonicalTileID(2, 1, 0).url(['{z}/{x}/{y}.json'], 1)).toBe('2/1/0.json');
    });

    test('.url replaces {quadkey}', () => {
        expect(new CanonicalTileID(1, 0, 0).url(['quadkey={quadkey}'], 1)).toBe('quadkey=0');
        expect(new CanonicalTileID(2, 0, 0).url(['quadkey={quadkey}'], 1)).toBe('quadkey=00');
        expect(new CanonicalTileID(2, 1, 1).url(['quadkey={quadkey}'], 1)).toBe('quadkey=03');
        expect(new CanonicalTileID(17, 22914, 52870).url(['quadkey={quadkey}'], 1)).toBe('quadkey=02301322130000230');

        // Test case confirmed by quadkeytools package
        expect(new CanonicalTileID(6, 29, 3).url(['quadkey={quadkey}'], 1)).toBe('quadkey=011123');

    });

    test('.url replaces {bbox-epsg-3857}', () => {
        expect(new CanonicalTileID(1, 0, 0).url(['bbox={bbox-epsg-3857}'], 1)).toBe('bbox=-20037508.342789244,0,0,20037508.342789244');
    });

    test('.url replaces {ratio}', () => {
        expect(new CanonicalTileID(1, 0, 0).url(['r={ratio}'], 2)).toBe('r=@2x');
        expect(new CanonicalTileID(1, 0, 0).url(['r={ratio}'], 1)).toBe('r=');
    });

    //Tests that multiple values of the same placeholder are replaced.
    test('.url replaces {z}/{x}/{y}/{z}/{x}/{y}', () => {
        expect(new CanonicalTileID(2, 1, 0).url(['{z}/{x}/{y}/{z}/{x}/{y}.json'], 1)).toBe('2/1/0/2/1/0.json');
    });
});

describe('OverscaledTileID', () => {
    test('constructor', () => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0) instanceof OverscaledTileID).toBeTruthy();
    });

    test('constructor - deeper canonicalZ than overscaledZ disallowed', () => {
        expect(() => new OverscaledTileID(7, 0, 8, 0, 0)).toThrow();
    });

    test('.key', () => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0).key).toBe('000');
        expect(new OverscaledTileID(1, 0, 1, 0, 0).key).toBe('011');
        expect(new OverscaledTileID(1, 0, 1, 1, 0).key).toBe('111');
        expect(new OverscaledTileID(1, 0, 1, 1, 1).key).toBe('311');
        expect(new OverscaledTileID(1, -1, 1, 1, 1).key).toBe('711');
    });

    test('.toString', () => {
        expect(new OverscaledTileID(1, 0, 1, 1, 1).toString()).toBe('1/1/1');
    });

    test('.children', () => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0).children(25)).toEqual([
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);
        expect(new OverscaledTileID(0, 0, 0, 0, 0).children(0)).toEqual([new OverscaledTileID(1, 0, 0, 0, 0)]);
    });

    test('.scaledTo returns a parent', () => {
        expect(new OverscaledTileID(2, 0, 2, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
        expect(new OverscaledTileID(1, 0, 1, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
        expect(new OverscaledTileID(1, 0, 0, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
    });

    test('.isChildOf - simple child of root tile', () => {
        const parent = new OverscaledTileID(0, 0, 0, 0, 0);
        const child = new OverscaledTileID(2, 0, 2, 0, 0);
        expect(child.isChildOf(parent)).toBeTruthy();
    });

    test('.isChildOf - not a child at a different wrap', () => {
        const parent = new OverscaledTileID(0, 1, 0, 0, 0);
        const child = new OverscaledTileID(2, 0, 2, 0, 0);
        expect(child.isChildOf(parent)).toBeFalsy();
    });

    test('.isChildOf - root tile should not be child of itself', () => {
        const root = new OverscaledTileID(0, 0, 0, 0, 0);
        expect(root.isChildOf(root)).toBe(false);
    });

    test('.isChildOf - child with different coordinates is not child of parent', () => {
        const parent = new OverscaledTileID(1, 0, 1, 0, 0);
        const child  = new OverscaledTileID(2, 0, 2, 2, 0);
        expect(child.isChildOf(parent)).toBe(false);
    });

    test('.isChildOf - descendant is child of ancestor', () => {
        const parent = new OverscaledTileID(1, 0, 1, 0, 0);
        const child  = new OverscaledTileID(4, 0, 4, 3, 5);
        expect(child.isChildOf(parent)).toBe(true);
    });

    test('.isChildOf - descendant with different coordinates is not child of ancestor', () => {
        const parent = new OverscaledTileID(1, 0, 1, 0, 0);
        const child  = new OverscaledTileID(4, 0, 4, 12, 9);
        expect(child.isChildOf(parent)).toBe(false);
    });

    test('.isChildOf - sibling is not a child', () => {
        const tileA = new OverscaledTileID(4, 0, 4, 4, 2);
        const tileB = new OverscaledTileID(4, 0, 4, 5, 2);
        expect(tileA.isChildOf(tileB)).toBe(false);
    });

    test('.normalizeCoordinates - in-bounds returns original tileID', () => {
        const tileID = new OverscaledTileID(2, 0, 2, 1, 1);
        const result = tileID.normalizeCoordinates(100, 100);
        expect(result.tileID).toBe(tileID);
        expect(result.x).toBe(100);
        expect(result.y).toBe(100);
    });

    test('.normalizeCoordinates - out-of-bounds x positive resolves right neighbor', () => {
        const tileID = new OverscaledTileID(2, 0, 2, 1, 1);
        const result = tileID.normalizeCoordinates(EXTENT + 100, 100);
        expect(result.tileID.canonical.x).toBe(2);
        expect(result.tileID.canonical.y).toBe(1);
        expect(result.tileID.canonical.z).toBe(2);
        expect(result.x).toBe(100);
        expect(result.y).toBe(100);
    });

    test('.normalizeCoordinates - out-of-bounds x negative resolves left neighbor', () => {
        const tileID = new OverscaledTileID(2, 0, 2, 1, 1);
        const result = tileID.normalizeCoordinates(-100, 100);
        expect(result.tileID.canonical.x).toBe(0);
        expect(result.tileID.canonical.y).toBe(1);
        expect(result.x).toBe(EXTENT - 100);
        expect(result.y).toBe(100);
    });

    test('.normalizeCoordinates - out-of-bounds y positive resolves bottom neighbor', () => {
        const tileID = new OverscaledTileID(2, 0, 2, 1, 1);
        const result = tileID.normalizeCoordinates(100, EXTENT + 100);
        expect(result.tileID.canonical.x).toBe(1);
        expect(result.tileID.canonical.y).toBe(2);
        expect(result.x).toBe(100);
        expect(result.y).toBe(100);
    });

    test('.normalizeCoordinates - y past world bounds (poles) returns null', () => {
        // At z=2, dim=4, tile y=3 is the last row. y beyond EXTENT goes to y=4 which is out of bounds.
        const tileID = new OverscaledTileID(2, 0, 2, 1, 3);
        const result = tileID.normalizeCoordinates(100, EXTENT + 100);
        expect(result).toBeNull();
    });

    test('.normalizeCoordinates - x wrapping across world boundary increases wrap', () => {
        // At z=2, dim=4, tile x=3 is the last column. x beyond EXTENT wraps to x=0 with wrap+1
        const tileID = new OverscaledTileID(2, 0, 2, 3, 1);
        const result = tileID.normalizeCoordinates(EXTENT + 100, 100);
        expect(result.tileID.canonical.x).toBe(0);
        expect(result.tileID.wrap).toBe(1);
        expect(result.x).toBe(100);
        expect(result.y).toBe(100);
    });

    test('.normalizeCoordinates - negative x wrapping across world boundary decreases wrap', () => {
        // At z=2, dim=4, tile x=0 is the first column. x < 0 wraps to x=3 with wrap-1
        const tileID = new OverscaledTileID(2, 0, 2, 0, 1);
        const result = tileID.normalizeCoordinates(-100, 100);
        expect(result.tileID.canonical.x).toBe(3);
        expect(result.tileID.wrap).toBe(-1);
        expect(result.x).toBe(EXTENT - 100);
        expect(result.y).toBe(100);
    });
});

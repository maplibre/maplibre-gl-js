import {CanonicalTileID} from '../source/tile_id';
import {TileBitmask} from './tile_bitmask';

describe('tile_bitmask', () => {
    test('basic direct sets', done => {
        const invalidated = new TileBitmask();
        invalidated.mark(1, 0, 0);
        expect(invalidated.isMarked(new CanonicalTileID(1, 0, 0))).toBeTruthy();
        expect(invalidated.isMarked(new CanonicalTileID(0, 0, 0))).toBeTruthy();
        expect(invalidated.isMarked(new CanonicalTileID(1, 1, 0))).toBeFalsy();
        done();
    });

    test('basic direct sets survives serialization', done => {
        const source = new TileBitmask();
        source.mark(1, 0, 0);
        const serialized = source.serialize();
        const invalidated = TileBitmask.deserialize(serialized);

        expect(invalidated.isMarked(new CanonicalTileID(1, 0, 0))).toBeTruthy();
        expect(invalidated.isMarked(new CanonicalTileID(0, 0, 0))).toBeTruthy();
        expect(invalidated.isMarked(new CanonicalTileID(1, 1, 0))).toBeFalsy();
        done();
    });

    test('sets past max zoom', done => {
        const source = new TileBitmask();
        source.mark(8, 0, 0);
        const serialized = source.serialize();
        const invalidated = TileBitmask.deserialize(serialized);
        expect(invalidated.isMarked(new CanonicalTileID(8, 0, 0))).toBeTruthy();
        expect(invalidated.isMarked(new CanonicalTileID(7, 0, 0))).toBeTruthy();
        expect(invalidated.isMarked(new CanonicalTileID(8, 4, 0))).toBeFalsy();
        done();
    });
});

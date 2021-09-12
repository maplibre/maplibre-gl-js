import {test} from '../../util/test';
import {CanonicalTileID, OverscaledTileID} from '../../../rollup/build/tsc/source/tile_id';

test('CanonicalTileID', (t) => {
    t.test('#constructor', (t) => {
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(-1, 0, 0);
        }).toThrow();
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(26, 0, 0);
        }).toThrow();
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(2, 4, 0);
        }).toThrow();
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(2, 0, 4);
        }).toThrow();
        t.end();
    });

    t.test('.key', (t) => {
        expect(new CanonicalTileID(0, 0, 0).key).toEqual("000");
        expect(new CanonicalTileID(1, 0, 0).key).toEqual("011");
        expect(new CanonicalTileID(1, 1, 0).key).toEqual("111");
        expect(new CanonicalTileID(1, 1, 1).key).toEqual("311");
        t.end();
    });

    t.test('.equals', (t) => {
        expect(new CanonicalTileID(3, 2, 1).equals(new CanonicalTileID(3, 2, 1))).toBeTruthy();
        expect(new CanonicalTileID(9, 2, 3).equals(new CanonicalTileID(3, 2, 1))).toBeFalsy();
        t.end();
    });

    t.test('.url', (t) => {
        t.test('replaces {z}/{x}/{y}', (t) => {
            expect(new CanonicalTileID(1, 0, 0).url(['{z}/{x}/{y}.json'])).toBe('1/0/0.json');
            t.end();
        });

        t.test('replaces {quadkey}', (t) => {
            expect(new CanonicalTileID(1, 0, 0).url(['quadkey={quadkey}'])).toBe('quadkey=0');
            expect(new CanonicalTileID(2, 0, 0).url(['quadkey={quadkey}'])).toBe('quadkey=00');
            expect(new CanonicalTileID(2, 1, 1).url(['quadkey={quadkey}'])).toBe('quadkey=03');
            expect(new CanonicalTileID(17, 22914, 52870).url(['quadkey={quadkey}'])).toBe('quadkey=02301322130000230');

            // Test case confirmed by quadkeytools package
            // https://bitbucket.org/steele/quadkeytools/rollup/build/tsc/master/test/quadkey.js?fileviewer=file-view-default#quadkey.js-57
            expect(new CanonicalTileID(6, 29, 3).url(['quadkey={quadkey}'])).toBe('quadkey=011123');

            t.end();
        });

        t.test('replaces {bbox-epsg-3857}', (t) => {
            expect(new CanonicalTileID(1, 0, 0).url(['bbox={bbox-epsg-3857}'])).toBe('bbox=-20037508.342789244,0,0,20037508.342789244');
            t.end();
        });

        t.end();
    });

    t.end();
});

test('OverscaledTileID', (t) => {
    t.test('#constructor', (t) => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0) instanceof OverscaledTileID).toBeTruthy();
        expect(() => {
            /*eslint no-new: 0*/
            new OverscaledTileID(7, 0, 8, 0, 0);
        }).toThrow();
        t.end();
    });

    t.test('.key', (t) => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0).key).toEqual("000");
        expect(new OverscaledTileID(1, 0, 1, 0, 0).key).toEqual("011");
        expect(new OverscaledTileID(1, 0, 1, 1, 0).key).toEqual("111");
        expect(new OverscaledTileID(1, 0, 1, 1, 1).key).toEqual("311");
        expect(new OverscaledTileID(1, -1, 1, 1, 1).key).toEqual("711");
        t.end();
    });

    t.test('.toString', (t) => {
        t.test('calculates strings', (t) => {
            expect(new OverscaledTileID(1, 0, 1, 1, 1).toString()).toEqual('1/1/1');
            t.end();
        });
        t.end();
    });

    t.test('.children', (t) => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0).children(25)).toEqual([
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);
        expect(new OverscaledTileID(0, 0, 0, 0, 0).children(0)).toEqual([new OverscaledTileID(1, 0, 0, 0, 0)]);
        t.end();
    });

    t.test('.scaledTo', (t) => {
        t.test('returns a parent', (t) => {
            expect(new OverscaledTileID(2, 0, 2, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
            expect(new OverscaledTileID(1, 0, 1, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
            expect(new OverscaledTileID(1, 0, 0, 0, 0).scaledTo(0)).toEqual(new OverscaledTileID(0, 0, 0, 0, 0));
            t.end();
        });
        t.end();
    });

    t.test('.isChildOf', (t) => {
        expect(
            new OverscaledTileID(2, 0, 2, 0, 0).isChildOf(new OverscaledTileID(0, 0, 0, 0, 0))
        ).toBeTruthy();
        expect(
            new OverscaledTileID(2, 0, 2, 0, 0).isChildOf(new OverscaledTileID(0, 1, 0, 0, 0))
        ).toBeFalsy();
        t.end();
    });

    t.end();
});

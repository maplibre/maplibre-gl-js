import {LngLat} from '../geo/lng_lat';
import {CanonicalTileID, OverscaledTileID, isInBoundsForTileZoomXY, isInBoundsForZoomLngLat} from '../source/tile_id';
import {MAX_TILE_ZOOM, MIN_TILE_ZOOM} from '../util/util';

describe('CanonicalTileID', () => {
    test('#constructor', () => {
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(MIN_TILE_ZOOM - 1, 0, 0);
        }).toThrow();
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(MAX_TILE_ZOOM + 1, 0, 0);
        }).toThrow();
        expect(() => {
            /*eslint no-new: 0*/
            new CanonicalTileID(2, 4, 0);
        }).toThrow();
        expect(() => {
            /*eslint no-new: 0*/
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
    test('#constructor', () => {
        expect(new OverscaledTileID(0, 0, 0, 0, 0) instanceof OverscaledTileID).toBeTruthy();
        expect(() => {
            /*eslint no-new: 0*/
            new OverscaledTileID(7, 0, 8, 0, 0);
        }).toThrow();
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

    test('.isChildOf', () => {
        expect(
            new OverscaledTileID(2, 0, 2, 0, 0).isChildOf(new OverscaledTileID(0, 0, 0, 0, 0))
        ).toBeTruthy();
        expect(
            new OverscaledTileID(2, 0, 2, 0, 0).isChildOf(new OverscaledTileID(0, 1, 0, 0, 0))
        ).toBeFalsy();
    });

});

describe('isInBoundsForTileZoomXY', () => {

    test('at zoom bounds', () => {
        const x = 0, y = 0;
        expect(isInBoundsForTileZoomXY(MIN_TILE_ZOOM, x, y)).toBeTruthy();
        expect(isInBoundsForTileZoomXY(MIN_TILE_ZOOM - 1, x, y)).toBeFalsy();
        expect(isInBoundsForTileZoomXY(MAX_TILE_ZOOM, x, y)).toBeTruthy();
        expect(isInBoundsForTileZoomXY(MAX_TILE_ZOOM + 1, x, y)).toBeFalsy();
    });

    test('at X bounds', () => {
        const z = 2, y = 0;
        expect(isInBoundsForTileZoomXY(z, 0, y)).toBeTruthy();
        expect(isInBoundsForTileZoomXY(z, -1, y)).toBeFalsy();
        expect(isInBoundsForTileZoomXY(z, 3, y )).toBeTruthy();
        expect(isInBoundsForTileZoomXY(z, 4, y)).toBeFalsy();
    });

    test('at Y bounds', () => {
        const z = 2, x = 0;
        expect(isInBoundsForTileZoomXY(z, x, 0)).toBeTruthy();
        expect(isInBoundsForTileZoomXY(z, x, -1)).toBeFalsy();
        expect(isInBoundsForTileZoomXY(z, x, 3)).toBeTruthy();
        expect(isInBoundsForTileZoomXY(z, x, 4)).toBeFalsy();
    });

});

describe('isInBoundsForZoomLngLat', () => {

    test('at zoom bounds', () => {
        const lnglat = new LngLat(0, 0);
        expect(isInBoundsForZoomLngLat(MIN_TILE_ZOOM, lnglat)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(MIN_TILE_ZOOM - 1, lnglat)).toBeFalsy();
        expect(isInBoundsForZoomLngLat(MAX_TILE_ZOOM, lnglat)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(MAX_TILE_ZOOM + 1, lnglat)).toBeFalsy();
    });


    test('at longitude bounds', () => {
        const z = 0, lat = 0, maxLng = 180;
        expect(isInBoundsForZoomLngLat(z, new LngLat(-180, lat))).toBeTruthy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(-181, lat))).toBeFalsy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(179, lat))).toBeTruthy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(180, lat))).toBeFalsy();
    });

    test('at latitude bounds', () => {
        const z = 0, lng = 0;
        expect(isInBoundsForZoomLngLat(z, new LngLat(lng, 85.05))).toBeTruthy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(lng, 85.06))).toBeFalsy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(lng, -85.05))).toBeTruthy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(lng, -85.06))).toBeFalsy();
    });

});

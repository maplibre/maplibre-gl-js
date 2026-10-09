import {describe, test, expect, beforeEach} from 'vitest';
import {isInBoundsForTileZoomXY, isInBoundsForZoomLngLat} from './world_bounds.ts';
import {MAX_TILE_ZOOM, MIN_TILE_ZOOM} from './util.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {mercatorWorldCoordinateHelper} from '../geo/mercator_coordinate.ts';
import {CrsWorldCoordinateHelper} from '../geo/projection/crs.ts';
import {createRotatedCrs} from './test/util.ts';

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
        expect(isInBoundsForTileZoomXY(z, 3, y)).toBeTruthy();
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
        expect(isInBoundsForZoomLngLat(MIN_TILE_ZOOM, lnglat, mercatorWorldCoordinateHelper)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(MIN_TILE_ZOOM - 1, lnglat, mercatorWorldCoordinateHelper)).toBeFalsy();
        expect(isInBoundsForZoomLngLat(MAX_TILE_ZOOM, lnglat, mercatorWorldCoordinateHelper)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(MAX_TILE_ZOOM + 1, lnglat, mercatorWorldCoordinateHelper)).toBeFalsy();
    });

    test('at longitude bounds', () => {
        const z = 0, lat = 0;
        expect(isInBoundsForZoomLngLat(z, new LngLat(-180, lat), mercatorWorldCoordinateHelper)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(-181, lat), mercatorWorldCoordinateHelper)).toBeFalsy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(179, lat), mercatorWorldCoordinateHelper)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(180, lat), mercatorWorldCoordinateHelper)).toBeFalsy();
    });

    test('at latitude bounds', () => {
        const z = 0, lng = 0;
        expect(isInBoundsForZoomLngLat(z, new LngLat(lng, 85.05), mercatorWorldCoordinateHelper)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(lng, 85.06), mercatorWorldCoordinateHelper)).toBeFalsy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(lng, -85.05), mercatorWorldCoordinateHelper)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(z, new LngLat(lng, -85.06), mercatorWorldCoordinateHelper)).toBeFalsy();
    });

});

describe('isInBoundsForZoomLngLat with a rotated world coordinate helper', () => {
    let rotatedWorldCoordinates: CrsWorldCoordinateHelper;

    beforeEach(() => {
        rotatedWorldCoordinates = new CrsWorldCoordinateHelper(createRotatedCrs());
    });

    test('accepts a location beyond the mercator pole that lies inside the rotated square', () => {
        const beyondTheMercatorPole = new LngLat(0, 89);

        expect(isInBoundsForZoomLngLat(3, beyondTheMercatorPole, rotatedWorldCoordinates)).toBe(true);
    });

    test('rejects a location inside the mercator world that lies outside the rotated square', () => {
        const insideMercatorOutsideTheRotatedSquare = new LngLat(-179, 84);

        expect(isInBoundsForZoomLngLat(3, insideMercatorOutsideTheRotatedSquare, rotatedWorldCoordinates)).toBe(false);
    });
});

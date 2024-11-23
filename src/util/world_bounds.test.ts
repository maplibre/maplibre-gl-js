import {describe, test, expect} from 'vitest';
import {isInBoundsForTileZoomXY, isInBoundsForZoomLngLat} from './world_bounds';
import {MAX_TILE_ZOOM, MIN_TILE_ZOOM} from './util';
import {LngLat} from '../geo/lng_lat';

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
        expect(isInBoundsForZoomLngLat(MIN_TILE_ZOOM, lnglat)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(MIN_TILE_ZOOM - 1, lnglat)).toBeFalsy();
        expect(isInBoundsForZoomLngLat(MAX_TILE_ZOOM, lnglat)).toBeTruthy();
        expect(isInBoundsForZoomLngLat(MAX_TILE_ZOOM + 1, lnglat)).toBeFalsy();
    });

    test('at longitude bounds', () => {
        const z = 0, lat = 0;
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

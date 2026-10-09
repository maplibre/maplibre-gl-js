import {test, expect, describe} from 'vitest';
import {CanonicalTileID} from './tile_id.ts';
import {tileIdToLngLatBounds} from './tile_id_to_lng_lat_bounds.ts';
import {mercatorWorldCoordinateHelper} from '../geo/mercator_coordinate.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {CrsWorldCoordinateHelper} from '../geo/projection/crs.ts';
import {createRotatedCrs} from '../util/test/util.ts';

describe('tileIdToLngLatBounds', () => {
    test('tile 0/0/0 covers the full world', () => {
        const bounds =  tileIdToLngLatBounds(new CanonicalTileID(0, 0, 0), 0, mercatorWorldCoordinateHelper);
        expect(bounds.getWest()).toBeCloseTo(-180, 0);
        expect(bounds.getEast()).toBeCloseTo(180, 0);
        expect(bounds.getSouth()).toBeCloseTo(-85, 0);
        expect(bounds.getNorth()).toBeCloseTo(85, 0);
    });

    test('tile 1/1/1', () => {
        const bounds = tileIdToLngLatBounds(new CanonicalTileID(1, 1, 1), 0, mercatorWorldCoordinateHelper);
        expect(bounds.getWest()).toBeCloseTo(0, 0);
        expect(bounds.getEast()).toBeCloseTo(180, 0);
        expect(bounds.getSouth()).toBeCloseTo(-85, 0);
        expect(bounds.getNorth()).toBeCloseTo(0, 0);
    });

    test('with buffer', () => {
        const bounds = tileIdToLngLatBounds(new CanonicalTileID(1, 0, 0), 0.25, mercatorWorldCoordinateHelper);
        const boundsNoBuffer = tileIdToLngLatBounds(new CanonicalTileID(1, 0, 0), 0, mercatorWorldCoordinateHelper);

        // With buffer, bounds should extend beyond the no-buffer bounds
        expect(bounds.getWest()).toBeLessThan(boundsNoBuffer.getWest());
        expect(bounds.getEast()).toBeGreaterThan(boundsNoBuffer.getEast());
        expect(bounds.getSouth()).toBeLessThan(boundsNoBuffer.getSouth());
        expect(bounds.getNorth()).toBeGreaterThan(boundsNoBuffer.getNorth());
    });
});

describe('tileIdToLngLatBounds with a non-cylindrical world coordinate helper', () => {
    test('follows the helper, not mercator', () => {
        const rotatedWorldCoordinates = new CrsWorldCoordinateHelper(createRotatedCrs());
        const z = 3;
        const worldSize = Math.pow(2, z);
        const {x, y} = rotatedWorldCoordinates.worldFromLngLat(105, 45);
        const tileID = new CanonicalTileID(z, Math.floor(x * worldSize), Math.floor(y * worldSize));

        const rotatedBounds = tileIdToLngLatBounds(tileID, 0, rotatedWorldCoordinates);
        const mercatorBounds = tileIdToLngLatBounds(tileID, 0, mercatorWorldCoordinateHelper);

        expect(rotatedBounds.contains(new LngLat(105, 45))).toBe(true);
        expect(mercatorBounds.contains(new LngLat(105, 45))).toBe(false);
    });

    test('contains every corner of the tile', () => {
        const rotatedWorldCoordinates = new CrsWorldCoordinateHelper(createRotatedCrs());
        const z = 3;
        const worldSize = Math.pow(2, z);
        const {x, y} = rotatedWorldCoordinates.worldFromLngLat(105, 45);
        const tileID = new CanonicalTileID(z, Math.floor(x * worldSize), Math.floor(y * worldSize));
        const bounds = tileIdToLngLatBounds(tileID, 0, rotatedWorldCoordinates);

        for (const [cx, cy] of [[tileID.x, tileID.y], [tileID.x + 1, tileID.y], [tileID.x + 1, tileID.y + 1], [tileID.x, tileID.y + 1]]) {
            const corner = rotatedWorldCoordinates.lngLatFromWorld(cx / worldSize, cy / worldSize);
            expect(bounds.getWest()).toBeLessThanOrEqual(corner.lng);
            expect(bounds.getEast()).toBeGreaterThanOrEqual(corner.lng);
            expect(bounds.getSouth()).toBeLessThanOrEqual(corner.lat);
            expect(bounds.getNorth()).toBeGreaterThanOrEqual(corner.lat);
        }
    });
});

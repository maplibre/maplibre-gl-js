import {describe, test, expect} from 'vitest';
import {TileBounds} from './tile_bounds.ts';
import {CanonicalTileID} from './tile_id.ts';
import {mercatorWorldCoordinateHelper} from '../geo/mercator_coordinate.ts';
import {CrsWorldCoordinateHelper} from '../geo/projection/crs.ts';
import {createPolarStereographicCrs, createRotatedCrs} from '../util/test/util.ts';

describe('TileBounds.contains', () => {
    test('follows the helper, not mercator', () => {
        const rotatedWorldCoordinates = new CrsWorldCoordinateHelper(createRotatedCrs());
        const bounds: [number, number, number, number] = [100, 40, 110, 50];
        const z = 3;
        const worldSize = Math.pow(2, z);
        const rotated = new TileBounds(bounds, null, null, rotatedWorldCoordinates);
        const mercator = new TileBounds(bounds, null, null, mercatorWorldCoordinateHelper);

        const centerWorld = rotatedWorldCoordinates.worldFromLngLat(105, 45);
        const rotatedTile = new CanonicalTileID(z, Math.floor(centerWorld.x * worldSize), Math.floor(centerWorld.y * worldSize));
        const centerMercator = mercatorWorldCoordinateHelper.worldFromLngLat(105, 45);
        const mercatorTile = new CanonicalTileID(z, Math.floor(centerMercator.x * worldSize), Math.floor(centerMercator.y * worldSize));

        expect(rotatedTile.x).not.toBe(mercatorTile.x);
        expect(rotated.contains(rotatedTile)).toBe(true);
        expect(rotated.contains(mercatorTile)).toBe(false);
        expect(mercator.contains(mercatorTile)).toBe(true);
        expect(mercator.contains(rotatedTile)).toBe(false);
    });

    test('covers every tile touched by the corners of a box in a non-cylindrical helper', () => {
        const rotatedWorldCoordinates = new CrsWorldCoordinateHelper(createRotatedCrs());
        const bounds: [number, number, number, number] = [-10, -10, 10, 10];
        const z = 5;
        const worldSize = Math.pow(2, z);
        const rotated = new TileBounds(bounds, null, null, rotatedWorldCoordinates);
        for (const [lng, lat] of [[-10, -10], [10, -10], [10, 10], [-10, 10]]) {
            const {x, y} = rotatedWorldCoordinates.worldFromLngLat(lng, lat);
            expect(rotated.contains(new CanonicalTileID(z, Math.floor(x * worldSize), Math.floor(y * worldSize)))).toBe(true);
        }
    });

    test('contains every zoom 2 tile of the cap north of 60N in a polar stereographic CRS', () => {
        const polar = new CrsWorldCoordinateHelper(createPolarStereographicCrs());
        const capNorthOf60 = new TileBounds([-180, 60, 180, 90], null, null, polar);
        const tilesPerSideAtZoom2 = 4;
        for (let x = 0; x < tilesPerSideAtZoom2; x++) {
            for (let y = 0; y < tilesPerSideAtZoom2; y++) {
                expect(capNorthOf60.contains(new CanonicalTileID(2, x, y))).toBe(true);
            }
        }
    });

    test('contains the tile at the rightmost point of 60N when no sample of the box lands on it', () => {
        const polar = new CrsWorldCoordinateHelper(createPolarStereographicCrs());
        const capFrom170WTo170E = new TileBounds([-170, 60, 170, 90], null, null, polar);
        const rightmostLngOf60N = 45;
        const z = 13;
        const worldSize = Math.pow(2, z);
        const {x, y} = polar.worldFromLngLat(rightmostLngOf60N, 60);
        expect(capFrom170WTo170E.contains(new CanonicalTileID(z, Math.floor(x * worldSize), Math.floor(y * worldSize)))).toBe(true);
    });
});

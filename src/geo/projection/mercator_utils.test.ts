import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {getBasicProjectionData, getMercatorHorizon, locationToMercatorCoordinate, projectToWorldCoordinates, tileCoordinatesToLocation, tileCoordinatesToMercatorCoordinates} from './mercator_utils';
import {MercatorTransform} from './mercator_transform';
import {MAX_VALID_LATITUDE} from '../transform_helper';
import {mat4} from 'gl-matrix';
import {CanonicalTileID, OverscaledTileID} from '../../source/tile_id';
import {EXTENT} from '../../data/extent';
import {expectToBeCloseToArray} from '../../util/test/util';
import type {ProjectionData} from './projection_data';

describe('mercator utils', () => {
    test('projectToWorldCoordinates basic', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.setZoom(10);
        expect(projectToWorldCoordinates(transform.worldSize, transform.center)).toEqual(new Point(262144, 262144));
    });

    test('projectToWorldCoordinates clamps latitude', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);

        expect(projectToWorldCoordinates(transform.worldSize, new LngLat(0, -90))).toEqual(projectToWorldCoordinates(transform.worldSize, new LngLat(0, -MAX_VALID_LATITUDE)));
        expect(projectToWorldCoordinates(transform.worldSize, new LngLat(0, 90))).toEqual(projectToWorldCoordinates(transform.worldSize, new LngLat(0, MAX_VALID_LATITUDE)));
    });

    test('locationCoordinate', () => {
        expect(locationToMercatorCoordinate(new LngLat(0, 0))).toEqual({x: 0.5, y: 0.5, z: 0});
    });

    test('getMercatorHorizon', () => {
        const transform = new MercatorTransform(0, 22, 0, 85, true);
        transform.resize(500, 500);
        transform.setPitch(75);
        const horizon = getMercatorHorizon(transform);

        expect(horizon).toBeCloseTo(170.8176101748407, 10);
    });

    describe('getBasicProjectionData', () => {
        test('posMatrix is set', () => {
            const mat = mat4.create();
            mat[0] = 1234;
            const projectionData = getBasicProjectionData(new OverscaledTileID(0, 0, 0, 0, 0), mat);
            expect(projectionData.fallbackMatrix).toEqual(mat);
        });

        test('mercator tile extents are set', () => {
            let projectionData: ProjectionData;

            projectionData = getBasicProjectionData(new OverscaledTileID(0, 0, 0, 0, 0));
            expectToBeCloseToArray(projectionData.tileMercatorCoords, [0, 0, 1 / EXTENT, 1 / EXTENT]);

            projectionData = getBasicProjectionData(new OverscaledTileID(1, 0, 1, 0, 0));
            expectToBeCloseToArray(projectionData.tileMercatorCoords, [0, 0, 0.5 / EXTENT, 0.5 / EXTENT]);

            projectionData = getBasicProjectionData(new OverscaledTileID(1, 0, 1, 1, 0));
            expectToBeCloseToArray(projectionData.tileMercatorCoords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });
    });

    describe('tileCoordinatesToMercatorCoordinates', () => {
        const precisionDigits = 10;

        test('Test 0,0', () => {
            const result = tileCoordinatesToMercatorCoordinates(0, 0, new CanonicalTileID(0, 0, 0));
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        test('Test tile center', () => {
            const result = tileCoordinatesToMercatorCoordinates(EXTENT / 2, EXTENT / 2, new CanonicalTileID(0, 0, 0));
            expect(result.x).toBeCloseTo(0.5, precisionDigits);
            expect(result.y).toBeCloseTo(0.5, precisionDigits);
        });

        test('Test higher zoom 0,0', () => {
            const result = tileCoordinatesToMercatorCoordinates(0, 0, new CanonicalTileID(3, 0, 0));
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        test('Test higher zoom tile center', () => {
            const result = tileCoordinatesToMercatorCoordinates(EXTENT / 2, EXTENT / 2, new CanonicalTileID(3, 0, 0));
            expect(result.x).toBeCloseTo(1 / 16, precisionDigits);
            expect(result.y).toBeCloseTo(1 / 16, precisionDigits);
        });
    });

    describe('tileCoordinatesToLocation', () => {
        const precisionDigits = 5;

        test('Test 0,0', () => {
            const result = tileCoordinatesToLocation(0, 0, new CanonicalTileID(0, 0, 0));
            expect(result.lng).toBeCloseTo(-180, precisionDigits);
            expect(result.lat).toBeCloseTo(MAX_VALID_LATITUDE, precisionDigits);
        });

        test('Test tile center', () => {
            const result = tileCoordinatesToLocation(EXTENT / 2, EXTENT / 2, new CanonicalTileID(0, 0, 0));
            expect(result.lng).toBeCloseTo(0, precisionDigits);
            expect(result.lat).toBeCloseTo(0, precisionDigits);
        });

        test('Test higher zoom 0,0', () => {
            const result = tileCoordinatesToLocation(0, 0, new CanonicalTileID(3, 0, 0));
            expect(result.lng).toBeCloseTo(-180, precisionDigits);
            expect(result.lat).toBeCloseTo(MAX_VALID_LATITUDE, precisionDigits);
        });

        test('Test higher zoom mercator center', () => {
            const result = tileCoordinatesToLocation(EXTENT, EXTENT, new CanonicalTileID(3, 3, 3));
            expect(result.lng).toBeCloseTo(0, precisionDigits);
            expect(result.lat).toBeCloseTo(0, precisionDigits);
        });
    });
});

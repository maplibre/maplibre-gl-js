import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {getMercatorHorizon, projectToWorldCoordinates, tileCoordinatesToLocation, tileCoordinatesToMercatorCoordinates} from './mercator_utils';
import {MercatorTransform} from './mercator_transform';
import {CanonicalTileID} from '../../tile/tile_id';
import {EXTENT} from '../../data/extent';
import {createIdentityMat4f32, MAX_VALID_LATITUDE} from '../../util/util';

describe('mercator utils', () => {
    test('projectToWorldCoordinates basic', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setZoom(10);
        expect(projectToWorldCoordinates(transform.worldSize, transform.center)).toEqual(new Point(262144, 262144));
    });

    test('projectToWorldCoordinates clamps latitude', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});

        expect(projectToWorldCoordinates(transform.worldSize, new LngLat(0, -90))).toEqual(projectToWorldCoordinates(transform.worldSize, new LngLat(0, -MAX_VALID_LATITUDE)));
        expect(projectToWorldCoordinates(transform.worldSize, new LngLat(0, 90))).toEqual(projectToWorldCoordinates(transform.worldSize, new LngLat(0, MAX_VALID_LATITUDE)));
    });

    test('getMercatorHorizon', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(500, 500);
        transform.setPitch(75);
        const horizon = getMercatorHorizon(transform);

        expect(horizon).toBeCloseTo(170.8176101748407, 10);
    });

    test('getMercatorHorizon90', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.resize(500, 500);
        transform.setPitch(90);
        const horizon = getMercatorHorizon(transform);

        expect(horizon).toBeCloseTo(-9.818037813626313, 10);
    });

    test('getMercatorHorizon95', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.resize(500, 500);
        transform.setPitch(95);
        const horizon = getMercatorHorizon(transform);

        expect(horizon).toBeCloseTo(-75.52102888757743, 10);
    });
    describe('getProjectionData', () => {
        test('return identity matrix when not passing overscaledTileID', () => {
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
            const projectionData = transform.getProjectionData({overscaledTileID: null});
            expect(projectionData.fallbackMatrix).toEqual(createIdentityMat4f32());
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

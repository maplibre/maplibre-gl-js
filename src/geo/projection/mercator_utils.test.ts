import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {cameraMercatorCoordinate, getMercatorHorizon, projectToWorldCoordinates, tileCoordinatesToLocation, tileCoordinatesToMercatorCoordinates} from './mercator_utils.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {GlobeTransform} from './globe_transform.ts';
import {altitudeFromMercatorZ} from '../mercator_coordinate.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';
import {EXTENT} from '../../data/extent.ts';
import {createIdentityMat4f32, MAX_VALID_LATITUDE} from '../../util/util.ts';

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
    describe('cameraMercatorCoordinate', () => {
        test('places the camera above the ground', () => {
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
            transform.setElevation(200);
            transform.setCenter(new LngLat(15.0, 55.0));
            transform.setZoom(14);
            transform.setPitch(55);
            transform.setBearing(75);
            transform.resize(512, 512);

            const cameraCoord = cameraMercatorCoordinate(transform);

            expect(cameraCoord.toLngLat().lng).toBeCloseTo(14.973921529405033, 10);
            expect(cameraCoord.toLngLat().lat).toBeCloseTo(54.99599181678275, 10);
            expect(altitudeFromMercatorZ(cameraCoord.z, cameraCoord.y)).toBeCloseTo(transform.getCameraAltitude(), 0);
        });

        test('does not depend on the projection', () => {
            const precisionDigits = 10;
            const globeTransform = new GlobeTransform();
            globeTransform.resize(512, 512);
            globeTransform.setZoom(5);
            globeTransform.setCenter(new LngLat(15, 55));
            globeTransform.setMaxPitch(60);
            globeTransform.setPitch(55);
            globeTransform.setBearing(75);

            const mercatorTransform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
            mercatorTransform.resize(512, 512);
            mercatorTransform.setZoom(5);
            mercatorTransform.setCenter(new LngLat(15, 55));
            mercatorTransform.setPitch(55);
            mercatorTransform.setBearing(75);

            const cameraCoord = cameraMercatorCoordinate(globeTransform);
            const mercatorCameraCoord = cameraMercatorCoordinate(mercatorTransform);

            expect(cameraCoord.x).toBeCloseTo(mercatorCameraCoord.x, precisionDigits);
            expect(cameraCoord.y).toBeCloseTo(mercatorCameraCoord.y, precisionDigits);
            expect(cameraCoord.z).toBeCloseTo(mercatorCameraCoord.z, precisionDigits);

            // The pixel under a pitched globe camera misses the sphere, so the screen round trip lands elsewhere.
            const screenRoundTrip = globeTransform.screenPointToMercatorCoordinate(globeTransform.getCameraPoint());
            expect(cameraCoord.toLngLat().distanceTo(screenRoundTrip.toLngLat())).toBeGreaterThan(50000);
        });
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

        test('0,0', () => {
            const result = tileCoordinatesToMercatorCoordinates(0, 0, new CanonicalTileID(0, 0, 0));
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        test('tile center', () => {
            const result = tileCoordinatesToMercatorCoordinates(EXTENT / 2, EXTENT / 2, new CanonicalTileID(0, 0, 0));
            expect(result.x).toBeCloseTo(0.5, precisionDigits);
            expect(result.y).toBeCloseTo(0.5, precisionDigits);
        });

        test('higher zoom 0,0', () => {
            const result = tileCoordinatesToMercatorCoordinates(0, 0, new CanonicalTileID(3, 0, 0));
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        test('higher zoom tile center', () => {
            const result = tileCoordinatesToMercatorCoordinates(EXTENT / 2, EXTENT / 2, new CanonicalTileID(3, 0, 0));
            expect(result.x).toBeCloseTo(1 / 16, precisionDigits);
            expect(result.y).toBeCloseTo(1 / 16, precisionDigits);
        });
    });

    describe('tileCoordinatesToLocation', () => {
        const precisionDigits = 5;

        test('0,0', () => {
            const result = tileCoordinatesToLocation(0, 0, new CanonicalTileID(0, 0, 0));
            expect(result.lng).toBeCloseTo(-180, precisionDigits);
            expect(result.lat).toBeCloseTo(MAX_VALID_LATITUDE, precisionDigits);
        });

        test('tile center', () => {
            const result = tileCoordinatesToLocation(EXTENT / 2, EXTENT / 2, new CanonicalTileID(0, 0, 0));
            expect(result.lng).toBeCloseTo(0, precisionDigits);
            expect(result.lat).toBeCloseTo(0, precisionDigits);
        });

        test('higher zoom 0,0', () => {
            const result = tileCoordinatesToLocation(0, 0, new CanonicalTileID(3, 0, 0));
            expect(result.lng).toBeCloseTo(-180, precisionDigits);
            expect(result.lat).toBeCloseTo(MAX_VALID_LATITUDE, precisionDigits);
        });

        test('higher zoom mercator center', () => {
            const result = tileCoordinatesToLocation(EXTENT, EXTENT, new CanonicalTileID(3, 3, 3));
            expect(result.lng).toBeCloseTo(0, precisionDigits);
            expect(result.lat).toBeCloseTo(0, precisionDigits);
        });
    });
});

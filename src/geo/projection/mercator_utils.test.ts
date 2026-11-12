import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {cameraMercatorCoordinate, degreesPerWorldUnit, getMercatorHorizon, getMercatorTileCoordinates, lngLatBoxToWorldBox, projectToWorldCoordinates, tileCoordinatesToLocation, tileCoordinatesToMercatorCoordinates, unprojectFromWorldCoordinates, worldBoxToLngLatBox} from './mercator_utils.ts';
import {mercatorWorldCoordinateHelper} from '../mercator_coordinate.ts';
import {CRSWorldCoordinateHelper, identityCrs} from './crs.ts';
import {createGlobeCameraProjection, createMercatorCameraProjection} from './camera_projection.ts';
import {createCameraState} from '../camera_state.ts';
import * as cameraUpdates from './camera_updates.ts';
import {altitudeFromMercatorZ} from '../mercator_coordinate.ts';
import {CanonicalTileID, OverscaledTileID} from '../../tile/tile_id.ts';
import {EXTENT} from '../../data/extent.ts';
import {createIdentityMat4f32, MAX_VALID_LATITUDE} from '../../util/util.ts';
import {createRotatedCrs, createTestCamera, expectToBeCloseToArray} from '../../util/test/util.ts';
import * as cameraMath from './camera_math.ts';

import type {CameraContext} from './camera_constrain.ts';

describe('mercator utils', () => {
    test('projectToWorldCoordinates basic', () => {
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true, zoom: 10});
        expect(projectToWorldCoordinates(projectedCamera.worldSize, projectedCamera.center, mercatorWorldCoordinateHelper)).toEqual(new Point(262144, 262144));
    });

    test('projectToWorldCoordinates clamps latitude', () => {
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});

        expect(projectToWorldCoordinates(projectedCamera.worldSize, new LngLat(0, -90), mercatorWorldCoordinateHelper)).toEqual(projectToWorldCoordinates(projectedCamera.worldSize, new LngLat(0, -MAX_VALID_LATITUDE), mercatorWorldCoordinateHelper));
        expect(projectToWorldCoordinates(projectedCamera.worldSize, new LngLat(0, 90), mercatorWorldCoordinateHelper)).toEqual(projectToWorldCoordinates(projectedCamera.worldSize, new LngLat(0, MAX_VALID_LATITUDE), mercatorWorldCoordinateHelper));
    });

    test('projectToWorldCoordinates does not clamp latitude for a non-wrapping helper', () => {
        const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);
        const worldSize = 1024;
        const pixelsPerDegree = worldSize / 180;
        const projected = projectToWorldCoordinates(worldSize, new LngLat(0, 89), worldCoordinateHelper);
        expect(projected.y).toBeCloseTo(pixelsPerDegree, 10);
        expect(unprojectFromWorldCoordinates(worldSize, projected, worldCoordinateHelper).lat).toBeCloseTo(89, 10);
    });

    test('degreesPerWorldUnit measures a world that does not wrap', () => {
        const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);

        expect(degreesPerWorldUnit(worldCoordinateHelper, new LngLat(10, 20))).toBeCloseTo(180, 6);
    });

    test('getMercatorHorizon', () => {
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true, width: 500, height: 500, pitch: 75});
        const horizon = getMercatorHorizon(projectedCamera);

        expect(horizon).toBeCloseTo(170.8176101748407, 10);
    });

    test('getMercatorHorizon90', () => {
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true, width: 500, height: 500, pitch: 90});
        const horizon = getMercatorHorizon(projectedCamera);

        expect(horizon).toBeCloseTo(-9.818037813626313, 10);
    });

    test('getMercatorHorizon95', () => {
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true, width: 500, height: 500, pitch: 95});
        const horizon = getMercatorHorizon(projectedCamera);

        expect(horizon).toBeCloseTo(-75.52102888757743, 10);
    });
    describe('cameraMercatorCoordinate', () => {
        test('places the camera above the ground', () => {
            const projection = createMercatorCameraProjection();
            const context: CameraContext = {projection, constrainOverride: null};
            let state = createCameraState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
            state = cameraUpdates.setElevation(state, context, 200);
            state = cameraUpdates.setCenter(state, context, new LngLat(15.0, 55.0));
            state = cameraUpdates.setZoom(state, context, 14);
            state = cameraUpdates.setPitch(state, 55);
            state = cameraUpdates.setBearing(state, 75);
            state = cameraUpdates.resize(state, context, 512, 512);
            const projectedCamera = cameraMath.projectCamera(state, projection);

            const cameraCoord = cameraMercatorCoordinate(projectedCamera, projection.worldCoordinateHelper);

            expect(cameraCoord.toLngLat().lng).toBeCloseTo(14.973921529405033, 10);
            expect(cameraCoord.toLngLat().lat).toBeCloseTo(54.99599181678275, 10);
            expect(altitudeFromMercatorZ(cameraCoord.z, cameraCoord.y)).toBeCloseTo(cameraMath.getCameraAltitude(projectedCamera), 0);
        });

        test('does not depend on the projection', () => {
            const precisionDigits = 10;
            const globe = createTestCamera({maxPitch: 60, width: 512, height: 512, zoom: 5, center: [15, 55], pitch: 55, bearing: 75}, createGlobeCameraProjection());
            const mercator = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true, width: 512, height: 512, zoom: 5, center: [15, 55], pitch: 55, bearing: 75});

            const cameraCoord = cameraMercatorCoordinate(globe.projectedCamera, globe.context.projection.worldCoordinateHelper);
            const mercatorCameraCoord = cameraMercatorCoordinate(mercator.projectedCamera, mercator.context.projection.worldCoordinateHelper);

            expect(cameraCoord.x).toBeCloseTo(mercatorCameraCoord.x, precisionDigits);
            expect(cameraCoord.y).toBeCloseTo(mercatorCameraCoord.y, precisionDigits);
            expect(cameraCoord.z).toBeCloseTo(mercatorCameraCoord.z, precisionDigits);

            // The pixel under a pitched globe camera misses the sphere, so the screen round trip lands elsewhere.
            const screenRoundTrip = cameraMath.screenPointToMercatorCoordinate(globe.projectedCamera, globe.context.projection, cameraMath.getCameraPoint(globe.projectedCamera));
            expect(cameraCoord.toLngLat().distanceTo(screenRoundTrip.toLngLat())).toBeGreaterThan(50000);
        });
    });

    describe('getProjectionData', () => {
        test('return identity matrix when not passing overscaledTileID', () => {
            const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
            const projectionData = cameraMath.getProjectionData(projectedCamera, {overscaledTileID: null});
            expect(projectionData.fallbackMatrix).toEqual(createIdentityMat4f32());
        });
    });

    describe('getMercatorTilesCoordinates', () => {
        test('mercator tile extents are set', () => {
            let tileMercatorCoords = getMercatorTileCoordinates(new OverscaledTileID(0, 0, 0, 0, 0));
            expectToBeCloseToArray(tileMercatorCoords, [0, 0, 1 / EXTENT, 1 / EXTENT]);

            tileMercatorCoords = getMercatorTileCoordinates(new OverscaledTileID(1, 0, 1, 0, 0));
            expectToBeCloseToArray(tileMercatorCoords, [0, 0, 0.5 / EXTENT, 0.5 / EXTENT]);

            tileMercatorCoords = getMercatorTileCoordinates(new OverscaledTileID(1, 0, 1, 1, 0));
            expectToBeCloseToArray(tileMercatorCoords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
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

describe('lngLatBoxToWorldBox and worldBoxToLngLatBox', () => {
    test('round trip a lng/lat box through the mercator helper', () => {
        const world = lngLatBoxToWorldBox(mercatorWorldCoordinateHelper, -120, -40, 30, 60);
        const back = worldBoxToLngLatBox(mercatorWorldCoordinateHelper, world.minX, world.minY, world.maxX, world.maxY);
        expect(back.west).toBeCloseTo(-120, 10);
        expect(back.south).toBeCloseTo(-40, 10);
        expect(back.east).toBeCloseTo(30, 10);
        expect(back.north).toBeCloseTo(60, 10);
    });

    test('map the whole world square of the identity CRS to lng/lat -90..90', () => {
        const worldCoordinateHelper = new CRSWorldCoordinateHelper(identityCrs);
        expect(worldBoxToLngLatBox(worldCoordinateHelper, 0, 0, 1, 1)).toEqual({west: -90, south: -90, east: 90, north: 90});
        expect(lngLatBoxToWorldBox(worldCoordinateHelper, -90, -90, 90, 90)).toEqual({minX: 0, minY: 0, maxX: 1, maxY: 1});
    });

    test('round trip through a rotated CRS contains the original box, since each direction takes the axis-aligned hull', () => {
        const worldCoordinateHelper = new CRSWorldCoordinateHelper(createRotatedCrs());
        const world = lngLatBoxToWorldBox(worldCoordinateHelper, -20, -10, 30, 40);
        const back = worldBoxToLngLatBox(worldCoordinateHelper, world.minX, world.minY, world.maxX, world.maxY);
        expect(back.west).toBeLessThan(-20);
        expect(back.south).toBeLessThan(-10);
        expect(back.east).toBeGreaterThan(30);
        expect(back.north).toBeGreaterThan(40);
    });
});

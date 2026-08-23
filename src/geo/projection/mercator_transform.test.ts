import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../../tile/tile_id.ts';
import {fixedLngLat, fixedCoord} from '../../../test/unit/lib/fixed.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {LngLatBounds} from '../lng_lat_bounds.ts';
import {getMercatorHorizon} from './mercator_utils.ts';
import {mat4} from 'gl-matrix';
import {createDEM, createDEMTerrain, createTerrain, expectToBeCloseToArray} from '../../util/test/util.ts';
import {EXTENT} from '../../data/extent.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import type {Tile} from '../../tile/tile.ts';

describe('transform', () => {
    test('creates a transform', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        expect(transform.unmodified).toBe(true);
        expect(transform.tileSize).toBe(512);
        expect(transform.worldSize).toBe(512);
        expect(transform.width).toBe(500);
        expect(transform.minZoom).toBe(0);
        expect(transform.minPitch).toBe(0);
        // Support signed zero
        expect(transform.bearing === 0 ? 0 : transform.bearing).toBe(0);
        transform.setBearing(1);
        expect(transform.bearing).toBe(1);
        expect([...transform.rotationMatrix]).toEqual([0.9998477101325989, -0.017452405765652657, 0.017452405765652657, 0.9998477101325989]);
        transform.setBearing(0);
        expect(transform.bearing).toBe(0);
        expect(transform.unmodified).toBe(false);
        transform.setMinZoom(10);
        expect(transform.minZoom).toBe(10);
        transform.setMaxZoom(10);
        expect(transform.maxZoom).toBe(10);
        expect(transform.minZoom).toBe(10);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        expect(transform.maxZoom).toBe(10);
        transform.setMinPitch(10);
        expect(transform.minPitch).toBe(10);
        transform.setMaxPitch(10);
        expect(transform.maxPitch).toBe(10);
        expect(transform.size.equals(new Point(500, 500))).toBe(true);
        expect(transform.centerPoint.equals(new Point(250, 250))).toBe(true);
        expect(transform.height).toBe(500);
        expect(transform.nearZ).toBe(10);
        expect(transform.farZ).toBe(804.8028169246645);
        expect([...transform.projectionMatrix]).toEqual([3, 0, 0, 0, 0, 3, 0, 0, -0, 0, -1.0251635313034058, -1, 0, 0, -20.25163459777832, 0]);
        expectToBeCloseToArray([...transform.inverseProjectionMatrix], [0.3333333333333333, 0, 0, 0, 0, 0.3333333333333333, 0, 0, 0, 0, 0, -0.04937872980873673, 0, 0, -1, 0.05062127019126326], 10);
        expectToBeCloseToArray([...mat4.multiply(new Float64Array(16), transform.projectionMatrix, transform.inverseProjectionMatrix)], [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1], 6);
        expect([...transform.modelViewProjectionMatrix]).toEqual([3, 0, 0, 0, 0, -2.954423259036624, -0.1780177690666898, -0.17364817766693033, -0, 0.006822967915294533, -0.013222891287479163, -0.012898324631281611, -786432, 774484.3308168967, 47414.91102496082, 46270.827886319785]);
        expect(fixedLngLat(transform.screenPointToLocation(new Point(250, 250)))).toEqual({lng: 0, lat: 0});
        expect(fixedCoord(transform.screenPointToMercatorCoordinate(new Point(250, 250)))).toEqual({x: 0.5, y: 0.5, z: 0});
        expect(fixedCoord(transform.screenPointToMercatorCoordinateAtZ(new Point(250, 250), 1))).toEqual({x: 0.5, y: 0.5000000044, z: 1});
        expect(transform.locationToScreenPoint(new LngLat(0, 0))).toEqual({x: 250, y: 250});
    });

    test('does not throw on bad center', () => {
        expect(() => {
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
            transform.resize(500, 500);
            transform.setCenter(new LngLat(50, -90));
        }).not.toThrow();
    });

    test('setLocationAt', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        transform.setZoom(4);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint(new LngLat(13, 10), new Point(15, 45));
        expect(fixedLngLat(transform.screenPointToLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAt tilted', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        transform.setZoom(4);
        transform.setPitch(50);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint(new LngLat(13, 10), new Point(15, 45));
        expect(fixedLngLat(transform.screenPointToLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAt tilted rolled', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        transform.setZoom(4);
        transform.setPitch(50);
        transform.setRoll(50);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint(new LngLat(13, 10), new Point(15, 45));
        expect(fixedLngLat(transform.screenPointToLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('has a default zoom', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        expect(transform.tileZoom).toBe(0);
        expect(transform.tileZoom).toBe(transform.zoom);
    });

    test('set zoom inits tileZoom with zoom value', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60});
        transform.setZoom(5);
        expect(transform.tileZoom).toBe(5);
    });

    test('set zoom clamps tileZoom to non negative value', () => {
        const transform = new MercatorTransform({minZoom: -2, maxZoom: 22, minPitch: 0, maxPitch: 60});
        transform.setZoom(-2);
        expect(transform.tileZoom).toBe(0);
    });

    test('set fov', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setFov(10);
        expect(transform.fov).toBe(10);
        transform.setFov(10);
        expect(transform.fov).toBe(10);
    });

    test('lngRange & latRange constrain zoom and center', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(10);
        transform.resize(500, 500);

        transform.setMaxBounds(new LngLatBounds([-5, -5, 5, 5]));

        transform.setZoom(0);
        expect(transform.zoom).toBe(5.1357092861044045);

        transform.setCenter(new LngLat(-50, -30));
        expect(transform.center).toEqual(new LngLat(0, -0.0063583052861417855));

        transform.setZoom(10);
        transform.setCenter(new LngLat(-50, -30));
        expect(transform.center).toEqual(new LngLat(-4.828338623046875, -4.828969771321582));
    });

    test('lngRange & latRange constrain zoom and center after cloning', () => {
        const old = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        old.setCenter(new LngLat(0, 0));
        old.setZoom(10);
        old.resize(500, 500);

        old.setMaxBounds(new LngLatBounds([-5, -5, 5, 5]));

        const transform = old.clone();

        transform.setZoom(0);
        expect(transform.zoom).toBe(5.1357092861044045);

        transform.setCenter(new LngLat(-50, -30));
        expect(transform.center).toEqual(new LngLat(0, -0.0063583052861417855));

        transform.setZoom(10);
        transform.setCenter(new LngLat(-50, -30));
        expect(transform.center).toEqual(new LngLat(-4.828338623046875, -4.828969771321582));
    });

    test('lngRange can constrain zoom and center across meridian', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setCenter(new LngLat(180, 0));
        transform.setZoom(10);
        transform.resize(500, 500);

        // equivalent ranges
        const lngRanges: Array<[number, number]> = [
            [175, -175], [175, 185], [-185, -175], [-185, 185]
        ];

        for (const lngRange of lngRanges) {
            transform.setMaxBounds(new LngLatBounds([lngRange[0], -5, lngRange[1], 5]));

            transform.setZoom(0);
            expect(transform.zoom).toBe(5.1357092861044045);

            transform.setCenter(new LngLat(-50, -30));
            expect(transform.center).toEqual(new LngLat(180, -0.0063583052861417855));

            transform.setZoom(10);
            transform.setCenter(new LngLat(-50, -30));
            expect(transform.center).toEqual(new LngLat(-175.171661376953125, -4.828969771321582));

            transform.setCenter(new LngLat(230, 0));
            expect(transform.center).toEqual(new LngLat(-175.171661376953125, 0));

            transform.setCenter(new LngLat(130, 0));
            expect(transform.center).toEqual(new LngLat(175.171661376953125, 0));
        }
    });

    test('clamps pitch', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});

        transform.setPitch(45);
        expect(transform.pitch).toBe(45);

        transform.setPitch(-10);
        expect(transform.pitch).toBe(0);

        transform.setPitch(90);
        expect(transform.pitch).toBe(60);
    });

    test('visibleUnwrappedCoordinates', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(200, 200);
        transform.setZoom(0);
        transform.setCenter(new LngLat(-170.01, 0.01));

        let unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        expect(unwrappedCoords).toHaveLength(4);

        //getVisibleUnwrappedCoordinates should honor _renderWorldCopies
        transform.setRenderWorldCopies(false);
        unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        expect(unwrappedCoords).toHaveLength(1);
    });

    test('maintains high float precision when calculating matrices', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(200.25, 200.25);
        transform.setZoom(20.25);
        transform.setPitch(67.25);
        transform.setCenter(new LngLat(0.0, 0.0));

        const customLayerMatrix = transform.getProjectionDataForCustomLayer().mainMatrix;
        expect(customLayerMatrix[0].toString().length).toBeGreaterThan(9);
        expect(transform.pixelsToClipSpaceMatrix[0].toString().length).toBeGreaterThan(9);
        expect(transform.maxPitchScaleFactor()).toBeCloseTo(2.366025418080343, 5);
    });

    test('recalculateZoomAndCenter: no change', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setElevation(200);
        transform.setCenter(new LngLat(10.0, 50.0));
        transform.setZoom(14);
        transform.setPitch(45);
        transform.resize(512, 512);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        const expectedCamLngLat = transform.getCameraLngLat();
        expect(expectedCamLngLat.lng).toBeCloseTo(10, 10);
        expect(expectedCamLngLat.lat).toBeCloseTo(49.9850171656428, 10);

        // expect same values because of no elevation change
        const terrain = {
            ...createTerrain(),
            getElevationForLngLatZoom: () => 200,
        };
        transform.recalculateZoomAndCenter(terrain as any);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBe(14);
    });

    test('recalculateZoomAndCenter: small elevation change at extreme latitude does not drastically shift center', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setElevation(200);
        transform.setPitch(60);
        transform.setZoom(3);
        transform.setCenter(new LngLat(0, 82));
        transform.resize(512, 512);

        expect(transform.center.lat).toBeCloseTo(82, 10);

        const terrain = {
            ...createTerrain(),
            getElevationForLngLatZoom: () => 200 + 1,
        };
        transform.recalculateZoomAndCenter(terrain as any);
        expect(transform.center.lat).toBeCloseTo(82, 4);
    });

    test('recalculateZoomAndCenter: elevation increase', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setElevation(200);
        transform.setCenter(new LngLat(10.0, 50.0));
        transform.setZoom(14);
        transform.setPitch(45);
        transform.resize(512, 512);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        const expectedCamLngLat = transform.getCameraLngLat();
        expect(expectedCamLngLat.lng).toBeCloseTo(10, 10);
        expect(expectedCamLngLat.lat).toBeCloseTo(49.9850171656428, 10);

        // expect new zoom and center because of elevation change
        const terrain = {
            ...createTerrain(),
            getElevationForLngLatZoom: () => 400,
        };
        transform.recalculateZoomAndCenter(terrain as any);
        expect(transform.elevation).toBe(400);
        expect(transform.center.lng).toBeCloseTo(10, 10);
        expect(transform.center.lat).toBeCloseTo(49.998201325627264, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        // Latitude precision is lower as a compromise to a stable recalculateZoomAndCenter at extreme latitudes
        expect(transform.getCameraLngLat().lat).toBeCloseTo(expectedCamLngLat.lat, 5);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(14.184585871638795, 10);
    });

    test('recalculateZoomAndCenter: elevation decrease', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setElevation(200);
        transform.setCenter(new LngLat(10.0, 50.0));
        transform.setZoom(14);
        transform.setPitch(45);
        transform.resize(512, 512);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        const expectedCamLngLat = transform.getCameraLngLat();
        expect(expectedCamLngLat.lng).toBeCloseTo(10, 10);
        expect(expectedCamLngLat.lat).toBeCloseTo(49.9850171656428, 10);

        // expect new zoom because of elevation change to point below sea level
        const terrain = {
            ...createTerrain(),
            getElevationForLngLatZoom: () => -200,
        };
        transform.recalculateZoomAndCenter(terrain as any);
        expect(transform.elevation).toBe(-200);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        // Latitude precision is lower as a compromise to a stable recalculateZoomAndCenter at extreme latitudes
        expect(transform.getCameraLngLat().lat).toBeCloseTo(expectedCamLngLat.lat, 5);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(13.68939960698451, 10);
    });

    test('recalculateZoomAndCenterNoTerrain', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.setElevation(200);
        transform.setCenter(new LngLat(10.0, 50.0));
        transform.setZoom(14);
        transform.setPitch(45);
        transform.resize(512, 512);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        const expectedCamLngLat = transform.getCameraLngLat();
        expect(expectedCamLngLat.lng).toBeCloseTo(10, 10);
        expect(expectedCamLngLat.lat).toBeCloseTo(49.9850171656428, 10);

        // expect same values because of no elevation change
        transform.recalculateZoomAndCenter();
        expect(transform.elevation).toBeCloseTo(0, 10);
        expect(transform.center.lng).toBeCloseTo(10, 10);
        expect(transform.center.lat).toBeCloseTo(50.00179860708241, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        // Latitude precision is lower as a compromise to a stable recalculateZoomAndCenter at extreme latitudes
        expect(transform.getCameraLngLat().lat).toBeCloseTo(expectedCamLngLat.lat, 5);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(13.836362970131438, 10);
    });

    test('screenPointToMercatorCoordinate with terrain that covers nothing should fall back to 2D', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(500, 500);
        const coordinate = transform.screenPointToMercatorCoordinate(new Point(0, 0), createTerrain());

        expect(coordinate).toBeDefined();
    });

    test('getBounds with horizon', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(500, 500);

        transform.setPitch(60);
        expect(transform.getBounds().getNorthWest().toArray()).toStrictEqual(transform.screenPointToLocation(new Point(0, 0)).toArray());

        transform.setPitch(75);
        const top = Math.max(0, transform.height / 2 - getMercatorHorizon(transform));
        expect(top).toBeCloseTo(79.1823898251593, 10);
        expect(transform.getBounds().getNorthWest().toArray()).toStrictEqual(transform.screenPointToLocation(new Point(0, top)).toArray());
    });

    test('lngLatToCameraDepth', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(500, 500);
        transform.setCenter(new LngLat(10.0, 50.0));

        expect(transform.lngLatToCameraDepth(new LngLat(10, 50), 4)).toBeCloseTo(0.9997324396231673);
        transform.setPitch(60);
        expect(transform.lngLatToCameraDepth(new LngLat(10, 50), 4)).toBeCloseTo(0.9865782165762236);
    });

    test('projectTileCoordinates', () => {
        const precisionDigits = 10;
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(500, 500);
        transform.setCenter(new LngLat(10.0, 50.0));
        let projection = transform.projectTileCoordinates(1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 0);
        expect(projection.point.x).toBeCloseTo(0.07111111111111101, precisionDigits);
        expect(projection.point.y).toBeCloseTo(0.8719999854792714, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(750, precisionDigits);
        expect(projection.isOccluded).toBe(false);
        transform.setBearing(12);
        transform.setPitch(10);
        projection = transform.projectTileCoordinates(1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 0);
        expect(projection.point.x).toBeCloseTo(-0.10639783257205901, precisionDigits);
        expect(projection.point.y).toBeCloseTo(0.8136784996777623, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(787.6699126802941, precisionDigits);
        expect(projection.isOccluded).toBe(false);
    });

    test('getCameraLngLat', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setElevation(200);
        transform.setCenter(new LngLat(15.0, 55.0));
        transform.setZoom(14);
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        expect(transform.getCameraAltitude()).toBeCloseTo(1405.7075926414002, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(14.973921529405033, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(54.99599181678275, 10);

        transform.setRoll(31);

        expect(transform.getCameraAltitude()).toBeCloseTo(1405.7075926414002, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(14.973921529405033, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(54.99599181678275, 10);
    });

    test('calculateCenterFromCameraLngLatAlt no pitch no bearing', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const centerInfo = transform.calculateCenterFromCameraLngLatAlt(camLngLat, camAlt);
        transform.setZoom(centerInfo.zoom);
        transform.setCenter(centerInfo.center);
        transform.setElevation(centerInfo.elevation);
        expect(transform.zoom).toBeGreaterThan(0);
        expect(transform.getCameraAltitude()).toBeCloseTo(camAlt, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(camLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('calculateCenterFromCameraLngLatAlt no pitch', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 20;
        const centerInfo = transform.calculateCenterFromCameraLngLatAlt(camLngLat, camAlt, bearing);
        transform.setZoom(centerInfo.zoom);
        transform.setCenter(centerInfo.center);
        transform.setElevation(centerInfo.elevation);
        transform.setBearing(bearing);
        expect(transform.zoom).toBeGreaterThan(0);
        expect(transform.getCameraAltitude()).toBeCloseTo(camAlt, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(camLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('calculateCenterFromCameraLngLatAlt', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 40;
        const pitch = 30;
        const centerInfo = transform.calculateCenterFromCameraLngLatAlt(camLngLat, camAlt, bearing, pitch);
        transform.setZoom(centerInfo.zoom);
        transform.setCenter(centerInfo.center);
        transform.setElevation(centerInfo.elevation);
        transform.setBearing(bearing);
        transform.setPitch(pitch);
        expect(transform.zoom).toBeGreaterThan(0);
        expect(transform.getCameraAltitude()).toBeCloseTo(camAlt, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(camLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('calculateCenterFromCameraLngLatAlt 89 degrees pitch', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 40;
        const pitch = 88;
        const centerInfo = transform.calculateCenterFromCameraLngLatAlt(camLngLat, camAlt, bearing, pitch);
        transform.setZoom(centerInfo.zoom);
        transform.setCenter(centerInfo.center);
        transform.setElevation(centerInfo.elevation);
        transform.setBearing(bearing);
        transform.setPitch(pitch);
        expect(transform.zoom).toBeGreaterThan(0);
        expect(transform.getCameraAltitude()).toBeCloseTo(camAlt, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(camLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('calculateCenterFromCameraLngLatAlt 89.99 degrees pitch', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 40;
        const pitch = 89.99;
        const centerInfo = transform.calculateCenterFromCameraLngLatAlt(camLngLat, camAlt, bearing, pitch);
        transform.setZoom(centerInfo.zoom);
        transform.setCenter(centerInfo.center);
        transform.setElevation(centerInfo.elevation);
        transform.setBearing(bearing);
        transform.setPitch(pitch);
        expect(transform.zoom).toBeGreaterThan(0);
        expect(transform.getCameraAltitude()).toBeCloseTo(camAlt, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(camLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('calculateCenterFromCameraLngLatAlt 90 degrees pitch', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 40;
        const pitch = 90;
        const centerInfo = transform.calculateCenterFromCameraLngLatAlt(camLngLat, camAlt, bearing, pitch);
        transform.setZoom(centerInfo.zoom);
        transform.setCenter(centerInfo.center);
        transform.setElevation(centerInfo.elevation);
        transform.setBearing(bearing);
        transform.setPitch(pitch);
        expect(transform.zoom).toBeGreaterThan(0);
        expect(transform.getCameraAltitude()).toBeCloseTo(camAlt, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(camLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('calculateCenterFromCameraLngLatAlt 95 degrees pitch', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 40;
        const pitch = 95;
        const centerInfo = transform.calculateCenterFromCameraLngLatAlt(camLngLat, camAlt, bearing, pitch);
        transform.setZoom(centerInfo.zoom);
        transform.setCenter(centerInfo.center);
        transform.setElevation(centerInfo.elevation);
        transform.setBearing(bearing);
        transform.setPitch(pitch);
        expect(transform.zoom).toBeGreaterThan(0);
        expect(transform.getCameraAltitude()).toBeCloseTo(camAlt, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(camLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('calculateCenterFromCameraLngLatAlt 180 degrees pitch', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.setPitch(55);
        transform.setBearing(75);
        transform.resize(512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 40;
        const pitch = 180;
        const centerInfo = transform.calculateCenterFromCameraLngLatAlt(camLngLat, camAlt, bearing, pitch);
        transform.setZoom(centerInfo.zoom);
        transform.setCenter(centerInfo.center);
        transform.setElevation(centerInfo.elevation);
        transform.setBearing(bearing);
        transform.setPitch(pitch);
        expect(transform.zoom).toBeGreaterThan(0);
        expect(transform.getCameraAltitude()).toBeCloseTo(camAlt, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(camLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(camLngLat.lat, 10);
    });

    describe('getProjectionData', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        transform.resize(512, 512);
        test('parses OverscaledTileID', () => {
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
            transform.resize(512, 512);
            const projectionData = transform.getProjectionData({overscaledTileID: new OverscaledTileID(1, 0, 1, 1, 0)});
            expectToBeCloseToArray(projectionData.tileMercatorCoords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });
        test('parses null', () => {
            const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
            transform.resize(512, 512);
            const projectionData = transform.getProjectionData({overscaledTileID: null});
            expectToBeCloseToArray(projectionData.tileMercatorCoords, [0, 0, 1, 1]);
        });
    });
});

function createMercatorTransform(center: LngLat, zoom: number, pitch: number = 0): MercatorTransform {
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
    transform.resize(512, 512);
    transform.setCenter(center);
    transform.setZoom(zoom);
    transform.setPitch(pitch);
    return transform;
}

function createRayTransform(near: number[], far: number[], worldSize: number): MercatorTransform {
    const transform = Object.create(MercatorTransform.prototype);
    Object.defineProperty(transform, 'worldSize', {value: worldSize});
    transform.getRaySegmentFromPixel = () => ({near, far});
    return transform as MercatorTransform;
}

function expectWorldPixelsClose(actual: MercatorCoordinate, expected: MercatorCoordinate, worldSize: number): void {
    expect(Math.abs(actual.x - expected.x) * worldSize).toBeLessThan(1e-3);
    expect(Math.abs(actual.y - expected.y) * worldSize).toBeLessThan(1e-3);
}

describe('MercatorTransform.screenTerrainPointToMercatorCoordinate', () => {
    test('matches the plane intersection for a flat DEM', () => {
        const height = 500;
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => height));
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 45);

        for (const p of [new Point(256, 256), new Point(100, 400), new Point(400, 300)]) {
            const result = transform.screenTerrainPointToMercatorCoordinate(p, terrain);
            expect(result).not.toBeNull();
            expectWorldPixelsClose(result, transform.screenPointToMercatorCoordinateAtZ(p, height), transform.worldSize);
            expect(result.z).toBeCloseTo(height, 10);
        }
    });

    test('applies the terrain exaggeration to the hit elevation', () => {
        const height = 300;
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => height), 2.5);
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 30);

        const result = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain);

        expect(result.z).toBeCloseTo(height * 2.5, 10);
        expectWorldPixelsClose(result, transform.screenPointToMercatorCoordinateAtZ(new Point(256, 256), height * 2.5), transform.worldSize);
    });

    test('the hit elevation matches the terrain elevation at the hit position', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM((x) => x * 400));
        const transform = createMercatorTransform(new LngLat(0, 0), 3, 60);

        for (const p of [new Point(200, 300), new Point(256, 350), new Point(330, 420)]) {
            const result = transform.screenTerrainPointToMercatorCoordinate(p, terrain);
            expect(result).not.toBeNull();
            const elevation = terrain.getElevation(tileID, result.x * EXTENT, result.y * EXTENT, EXTENT);
            expect(elevation).toBeCloseTo(result.z, 6);
        }
    });

    test('follows a ramp across a tile boundary', () => {
        const tileIDs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => new OverscaledTileID(1, 0, 1, x, y));
        const terrain = createDEMTerrain(tileIDs, createDEM((x) => x * 200));
        const transform = createMercatorTransform(new LngLat(0, 40), 2, 50);
        const crossed = new Set<number>();

        for (const p of [new Point(180, 300), new Point(256, 300), new Point(340, 300)]) {
            const result = transform.screenTerrainPointToMercatorCoordinate(p, terrain);
            expect(result).not.toBeNull();
            const tileX = Math.floor(result.x * 2);
            const tileY = Math.floor(result.y * 2);
            crossed.add(tileX);
            const tileID = new OverscaledTileID(1, 0, 1, tileX, tileY);
            const elevation = terrain.getElevation(tileID, (result.x * 2 - tileX) * EXTENT, (result.y * 2 - tileY) * EXTENT, EXTENT);
            expect(elevation).toBeCloseTo(result.z, 6);
        }

        expect(crossed.size).toBe(2);
    });

    test('returns null when the ray never crosses the terrain surface', () => {
        // Into the sky.
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const skyTransform = createMercatorTransform(new LngLat(0, 0), 4, 80);
        expect(skyTransform.screenTerrainPointToMercatorCoordinate(new Point(256, 0), terrain)).toBeNull();

        // Leaving the world vertically past the covered tiles.
        const edgeTerrain = createDEMTerrain([new OverscaledTileID(1, 0, 1, 0, 0)], createDEM(() => 0));
        const edgeTransform = createMercatorTransform(new LngLat(0, 0), 1, 0);
        expect(edgeTransform.screenTerrainPointToMercatorCoordinate(new Point(400, 400), edgeTerrain)).toBeNull();

        // Staying below the terrain surface the whole way.
        const submergedTerrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 100));
        const submergedTransform = createRayTransform([256, 256, -100], [300, 256, 100], 512);
        expect(submergedTransform.screenTerrainPointToMercatorCoordinate(new Point(0, 0), submergedTerrain)).toBeNull();
    });

    test('returns null when the terrain has no renderable tiles', () => {
        const terrain = createDEMTerrain([], null);
        const transform = createMercatorTransform(new LngLat(0, 0), 4);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain)).toBeNull();
    });

    test('hits a renderable tile whose DEM has not loaded at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], null);
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 40);
        const p = new Point(256, 300);

        const result = transform.screenTerrainPointToMercatorCoordinate(p, terrain);

        expect(result.z).toBe(0);
        expectWorldPixelsClose(result, transform.screenPointToMercatorCoordinateAtZ(p, 0), transform.worldSize);
    });

    test('returns coordinates outside the central world for wrapped copies', () => {
        const tileIDs = [-1, 0, 1, 2].map(wrap => new OverscaledTileID(0, wrap, 0, 0, 0));
        const terrain = createDEMTerrain(tileIDs, createDEM(() => 0));
        const transform = createMercatorTransform(new LngLat(0, 0), 0);
        transform.resize(2048, 512);

        const leftPoint = new Point(600, 256);
        const rightPoint = new Point(1500, 256);
        const left = transform.screenTerrainPointToMercatorCoordinate(leftPoint, terrain);
        const right = transform.screenTerrainPointToMercatorCoordinate(rightPoint, terrain);

        expect(left.x).toBeLessThan(0);
        expect(right.x).toBeGreaterThan(1);
        expectWorldPixelsClose(left, transform.screenPointToMercatorCoordinateAtZ(leftPoint, 0), transform.worldSize);
        expectWorldPixelsClose(right, transform.screenPointToMercatorCoordinateAtZ(rightPoint, 0), transform.worldSize);
    });

    test('samples overscaled tiles from their parent DEM', () => {
        const tileID = new OverscaledTileID(15, 0, 14, 8192, 8192);
        const parent = new OverscaledTileID(13, 0, 13, 4096, 4096);
        const dem = createDEM((x) => x * 100);
        const terrain = createDEMTerrain([tileID], dem);
        terrain.tileManager.getSourceTile = () => ({tileID: parent, dem}) as Tile;
        const scale = 1 << tileID.canonical.z;
        const center = new MercatorCoordinate((tileID.canonical.x + 0.5) / scale, (tileID.canonical.y + 0.5) / scale).toLngLat();
        const transform = createMercatorTransform(center, 15, 30);

        const result = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBeGreaterThan(0);
    });

    test('samples the far tile edge without throwing', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM(() => 100));

        expect(() => terrain.getElevation(tileID, EXTENT - 1e-9, EXTENT - 1e-9, EXTENT)).not.toThrow();

        const transform = createMercatorTransform(new LngLat(179.999, -85), 6, 0);
        expect(() => transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain)).not.toThrow();
    });

    test('skips renderable tiles that have no terrain tile yet', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 100));
        const tiles = terrain.tileManager.getRenderableTiles();
        terrain.tileManager.getRenderableTiles = () => [null, ...tiles];
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 30);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain).z).toBeCloseTo(100, 6);
    });

    test('samples the highest zoom tile covering the position', () => {
        const parentID = new OverscaledTileID(0, 0, 0, 0, 0);
        const childID = new OverscaledTileID(1, 0, 1, 0, 0);
        const parentDEM = createDEM(() => 100);
        const childDEM = createDEM(() => 900);
        const terrain = createDEMTerrain([parentID, childID], parentDEM);
        terrain.tileManager.getSourceTile = (tileID) => ({tileID, dem: tileID.canonical.z === 1 ? childDEM : parentDEM}) as Tile;
        const transform = createMercatorTransform(new LngLat(0, 0), 1, 0);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(128, 128), terrain).z).toBeCloseTo(900, 6);
        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(384, 384), terrain).z).toBeCloseTo(100, 6);
    });

    test('handles a ray with no vertical component', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM((x) => x * 200));
        const worldSize = 512;

        const crossing = createRayTransform([0, 256, 500], [512, 256, 500], worldSize);
        expect(crossing.screenTerrainPointToMercatorCoordinate(new Point(0, 0), terrain)).not.toBeNull();

        const aboveEverything = createRayTransform([0, 256, 5000], [512, 256, 5000], worldSize);
        expect(aboveEverything.screenTerrainPointToMercatorCoordinate(new Point(0, 0), terrain)).toBeNull();
    });
});

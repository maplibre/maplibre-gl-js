import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import {fixedLngLat, fixedCoord} from '../../../test/unit/lib/fixed';
import type {Terrain} from '../../render/terrain';
import {MercatorTransform} from './mercator_transform';
import {LngLatBounds} from '../lng_lat_bounds';
import {getMercatorHorizon} from './mercator_utils';
import {mat4} from 'gl-matrix';
import {expectToBeCloseToArray} from '../../util/test/util';

describe('transform', () => {
    test('creates a transform', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
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
        expectToBeCloseToArray([...mat4.multiply(new Float64Array(16) as any, transform.projectionMatrix, transform.inverseProjectionMatrix)], [
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
            const transform = new MercatorTransform(0, 22, 0, 60, true);
            transform.resize(500, 500);
            transform.setCenter(new LngLat(50, -90));
        }).not.toThrow();
    });

    test('setLocationAt', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        transform.setZoom(4);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint(new LngLat(13, 10), new Point(15, 45));
        expect(fixedLngLat(transform.screenPointToLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAt tilted', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        transform.setZoom(4);
        transform.setPitch(50);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint(new LngLat(13, 10), new Point(15, 45));
        expect(fixedLngLat(transform.screenPointToLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAt tilted rolled', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        transform.setZoom(4);
        transform.setPitch(50);
        transform.setRoll(50);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint(new LngLat(13, 10), new Point(15, 45));
        expect(fixedLngLat(transform.screenPointToLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('has a default zoom', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        expect(transform.tileZoom).toBe(0);
        expect(transform.tileZoom).toBe(transform.zoom);
    });

    test('set zoom inits tileZoom with zoom value', () => {
        const transform = new MercatorTransform(0, 22, 0, 60);
        transform.setZoom(5);
        expect(transform.tileZoom).toBe(5);
    });

    test('set zoom clamps tileZoom to non negative value ', () => {
        const transform = new MercatorTransform(-2, 22, 0, 60);
        transform.setZoom(-2);
        expect(transform.tileZoom).toBe(0);
    });

    test('set fov', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.setFov(10);
        expect(transform.fov).toBe(10);
        transform.setFov(10);
        expect(transform.fov).toBe(10);
    });

    test('lngRange & latRange constrain zoom and center', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
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
        const old = new MercatorTransform(0, 22, 0, 60, true);
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
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.setCenter(new LngLat(180, 0));
        transform.setZoom(10);
        transform.resize(500, 500);

        // equivalent ranges
        const lngRanges: [number, number][] = [
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
        const transform = new MercatorTransform(0, 22, 0, 60, true);

        transform.setPitch(45);
        expect(transform.pitch).toBe(45);

        transform.setPitch(-10);
        expect(transform.pitch).toBe(0);

        transform.setPitch(90);
        expect(transform.pitch).toBe(60);
    });

    test('visibleUnwrappedCoordinates', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
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
        const transform = new MercatorTransform(0, 22, 0, 60, true);
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
        const transform = new MercatorTransform(0, 22, 0, 60, true);
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
            getElevationForLngLatZoom: () => 200,
            pointCoordinate: () => null
        };
        transform.recalculateZoomAndCenter(terrain as any);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBe(14);
    });

    test('recalculateZoomAndCenter: elevation increase', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
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
            getElevationForLngLatZoom: () => 400,
            pointCoordinate: () => null
        };
        transform.recalculateZoomAndCenter(terrain as any);
        expect(transform.elevation).toBe(400);
        expect(transform.center.lng).toBeCloseTo(10, 10);
        expect(transform.center.lat).toBeCloseTo(49.99820083233254, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(expectedCamLngLat.lat, 10);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(14.184585886440686, 10);
    });

    test('recalculateZoomAndCenter: elevation decrease', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
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
            getElevationForLngLatZoom: () => -200,
            pointCoordinate: () => null
        };
        transform.recalculateZoomAndCenter(terrain as any);
        expect(transform.elevation).toBe(-200);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(expectedCamLngLat.lat, 10);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(13.689399565250616, 10);
    });

    test('recalculateZoomAndCenterNoTerrain', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
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
        expect(transform.center.lat).toBeCloseTo(50.00179923503546, 10);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(expectedCamLngLat.lat, 10);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(13.836362951286565, 10);
    });

    test('pointCoordinate with terrain when returning null should fall back to 2D', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        const terrain = {
            pointCoordinate: () => null
        } as any as Terrain;
        const coordinate = transform.screenPointToMercatorCoordinate(new Point(0, 0), terrain);

        expect(coordinate).toBeDefined();
    });

    test('getBounds with horizon', () => {
        const transform = new MercatorTransform(0, 22, 0, 85, true);
        transform.resize(500, 500);

        transform.setPitch(60);
        expect(transform.getBounds().getNorthWest().toArray()).toStrictEqual(transform.screenPointToLocation(new Point(0, 0)).toArray());

        transform.setPitch(75);
        const top = Math.max(0, transform.height / 2 - getMercatorHorizon(transform));
        expect(top).toBeCloseTo(79.1823898251593, 10);
        expect(transform.getBounds().getNorthWest().toArray()).toStrictEqual(transform.screenPointToLocation(new Point(0, top)).toArray());
    });

    test('lngLatToCameraDepth', () => {
        const transform = new MercatorTransform(0, 22, 0, 85, true);
        transform.resize(500, 500);
        transform.setCenter(new LngLat(10.0, 50.0));

        expect(transform.lngLatToCameraDepth(new LngLat(10, 50), 4)).toBeCloseTo(0.9997324396231673);
        transform.setPitch(60);
        expect(transform.lngLatToCameraDepth(new LngLat(10, 50), 4)).toBeCloseTo(0.9865782165762236);
    });

    test('projectTileCoordinates', () => {
        const precisionDigits = 10;
        const transform = new MercatorTransform(0, 22, 0, 85, true);
        transform.resize(500, 500);
        transform.setCenter(new LngLat(10.0, 50.0));
        let projection = transform.projectTileCoordinates(1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), (_x, _y) => 0);
        expect(projection.point.x).toBeCloseTo(0.07111111111111101, precisionDigits);
        expect(projection.point.y).toBeCloseTo(0.8719999854792714, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(750, precisionDigits);
        expect(projection.isOccluded).toBe(false);
        transform.setBearing(12);
        transform.setPitch(10);
        projection = transform.projectTileCoordinates(1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), (_x, _y) => 0);
        expect(projection.point.x).toBeCloseTo(-0.10639783257205901, precisionDigits);
        expect(projection.point.y).toBeCloseTo(0.8136784996777623, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(787.6699126802941, precisionDigits);
        expect(projection.isOccluded).toBe(false);
    });

    test('getCameraLngLat', () => {
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
        const transform = new MercatorTransform(0, 22, 0, 180, true);
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
});

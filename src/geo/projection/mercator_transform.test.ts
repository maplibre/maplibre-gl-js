import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {OverscaledTileID, CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
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
        expect([...transform.rotationMatrix.values()]).toEqual([0.9998477101325989, -0.017452405765652657, 0.017452405765652657, 0.9998477101325989]);
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
        expect([...transform.projectionMatrix.values()]).toEqual([3, 0, 0, 0, 0, 3, 0, 0, -0, 0, -1.0251635313034058, -1, 0, 0, -20.25163459777832, 0]);
        expectToBeCloseToArray([...transform.inverseProjectionMatrix.values()], [0.3333333333333333, 0, 0, 0, 0, 0.3333333333333333, 0, 0, 0, 0, 0, -0.04937872980873673, 0, 0, -1, 0.05062127019126326], 10);
        expectToBeCloseToArray([...mat4.multiply(new Float64Array(16) as any, transform.projectionMatrix, transform.inverseProjectionMatrix).values()], [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1], 6);
        expect([...transform.modelViewProjectionMatrix.values()]).toEqual([3, 0, 0, 0, 0, -2.954423259036624, -0.1780177690666898, -0.17364817766693033, 0, 0.006822967915294533, -0.013222891287479163, -0.012898324631281611, -786432, 774484.3308168967, 47414.91102496082, 46270.827886319785]);
        expect(fixedLngLat(transform.screenPointToLocation(new Point(250, 250)))).toEqual({lng: 0, lat: 0});
        expect(fixedCoord(transform.screenPointToMercatorCoordinate(new Point(250, 250)))).toEqual({x: 0.5, y: 0.5, z: 0});
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

    describe('coveringTiles', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(200, 200);

        test('general', () => {

            // make slightly off center so that sort order is not subject to precision issues
            transform.setCenter(new LngLat(-0.01, 0.01));

            transform.setZoom(0);
            expect(transform.coveringTiles(options)).toEqual([]);

            transform.setZoom(1);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 1, 0),
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, 0, 1, 1, 1)]);

            transform.setZoom(2.4);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, 0, 2, 1, 1),
                new OverscaledTileID(2, 0, 2, 2, 1),
                new OverscaledTileID(2, 0, 2, 1, 2),
                new OverscaledTileID(2, 0, 2, 2, 2)]);

            transform.setZoom(10);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(10, 0, 10, 511, 511),
                new OverscaledTileID(10, 0, 10, 512, 511),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512)]);

            transform.setZoom(11);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(10, 0, 10, 511, 511),
                new OverscaledTileID(10, 0, 10, 512, 511),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512)]);

            transform.setZoom(5.1);
            transform.setPitch(60.0);
            transform.setBearing(32.0);
            transform.setCenter(new LngLat(56.90, 48.20));
            transform.resize(1024, 768);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(5, 0, 5, 21, 11),
                new OverscaledTileID(5, 0, 5, 20, 11),
                new OverscaledTileID(5, 0, 5, 21, 10),
                new OverscaledTileID(5, 0, 5, 20, 10),
                new OverscaledTileID(5, 0, 5, 21, 12),
                new OverscaledTileID(5, 0, 5, 22, 11),
                new OverscaledTileID(5, 0, 5, 20, 12),
                new OverscaledTileID(5, 0, 5, 22, 10),
                new OverscaledTileID(5, 0, 5, 21, 9),
                new OverscaledTileID(5, 0, 5, 20, 9),
                new OverscaledTileID(5, 0, 5, 22, 9),
                new OverscaledTileID(5, 0, 5, 23, 10),
                new OverscaledTileID(5, 0, 5, 21, 8),
                new OverscaledTileID(5, 0, 5, 20, 8),
                new OverscaledTileID(5, 0, 5, 23, 9),
                new OverscaledTileID(5, 0, 5, 22, 8),
                new OverscaledTileID(5, 0, 5, 23, 8),
                new OverscaledTileID(5, 0, 5, 21, 7),
                new OverscaledTileID(5, 0, 5, 20, 7),
                new OverscaledTileID(5, 0, 5, 24, 9),
                new OverscaledTileID(5, 0, 5, 22, 7)
            ]);

            transform.setZoom(8);
            transform.setPitch(60);
            transform.setBearing(45.0);
            transform.setCenter(new LngLat(25.02, 60.15));
            transform.resize(300, 50);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(8, 0, 8, 145, 74),
                new OverscaledTileID(8, 0, 8, 145, 73),
                new OverscaledTileID(8, 0, 8, 146, 74)
            ]);

            transform.resize(50, 300);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(8, 0, 8, 145, 74),
                new OverscaledTileID(8, 0, 8, 145, 73),
                new OverscaledTileID(8, 0, 8, 146, 74),
                new OverscaledTileID(8, 0, 8, 146, 73)
            ]);

            transform.setZoom(2);
            transform.setPitch(0);
            transform.setBearing(0);
            transform.resize(300, 300);
        });

        test('calculates tile coverage at w > 0', () => {
            transform.setCenter(new LngLat(630.01, 0.01));
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, 2, 2, 1, 1),
                new OverscaledTileID(2, 2, 2, 1, 2),
                new OverscaledTileID(2, 2, 2, 0, 1),
                new OverscaledTileID(2, 2, 2, 0, 2)
            ]);
        });

        test('calculates tile coverage at w = -1', () => {
            transform.setCenter(new LngLat(-360.01, 0.01));
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, -1, 2, 1, 1),
                new OverscaledTileID(2, -1, 2, 1, 2),
                new OverscaledTileID(2, -1, 2, 2, 1),
                new OverscaledTileID(2, -1, 2, 2, 2)
            ]);
        });

        test('calculates tile coverage across meridian', () => {
            transform.setZoom(1);
            transform.setCenter(new LngLat(-180.01, 0.01));
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, -1, 1, 1, 0),
                new OverscaledTileID(1, -1, 1, 1, 1)
            ]);
        });

        test('only includes tiles for a single world, if renderWorldCopies is set to false', () => {
            transform.setZoom(1);
            transform.setCenter(new LngLat(-180.01, 0.01));
            transform.setRenderWorldCopies(false);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
        });

    });

    test('coveringZoomLevel', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512,
            roundZoom: false,
        };

        const transform = new MercatorTransform(0, 22, 0, 60, true);

        transform.setZoom(0);
        expect(transform.coveringZoomLevel(options)).toBe(0);

        transform.setZoom(0.1);
        expect(transform.coveringZoomLevel(options)).toBe(0);

        transform.setZoom(1);
        expect(transform.coveringZoomLevel(options)).toBe(1);

        transform.setZoom(2.4);
        expect(transform.coveringZoomLevel(options)).toBe(2);

        transform.setZoom(10);
        expect(transform.coveringZoomLevel(options)).toBe(10);

        transform.setZoom(11);
        expect(transform.coveringZoomLevel(options)).toBe(11);

        transform.setZoom(11.5);
        expect(transform.coveringZoomLevel(options)).toBe(11);

        options.tileSize = 256;

        transform.setZoom(0);
        expect(transform.coveringZoomLevel(options)).toBe(1);

        transform.setZoom(0.1);
        expect(transform.coveringZoomLevel(options)).toBe(1);

        transform.setZoom(1);
        expect(transform.coveringZoomLevel(options)).toBe(2);

        transform.setZoom(2.4);
        expect(transform.coveringZoomLevel(options)).toBe(3);

        transform.setZoom(10);
        expect(transform.coveringZoomLevel(options)).toBe(11);

        transform.setZoom(11);
        expect(transform.coveringZoomLevel(options)).toBe(12);

        transform.setZoom(11.5);
        expect(transform.coveringZoomLevel(options)).toBe(12);

        options.roundZoom = true;

        expect(transform.coveringZoomLevel(options)).toBe(13);
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

    test('recalculateZoom', () => {
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

        // expect same values because of no elevation change
        const terrain = {
            getElevationForLngLatZoom: () => 200,
            pointCoordinate: () => null
        };
        transform.recalculateZoom(terrain as any);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBe(14);

        // expect new zoom because of elevation change
        terrain.getElevationForLngLatZoom = () => 400;
        transform.recalculateZoom(terrain as any);
        expect(transform.elevation).toBe(400);
        expect(transform.center.lng).toBeCloseTo(10, 10);
        expect(transform.center.lat).toBeCloseTo(50, 10);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(14.1845318986, 10);

        // expect new zoom because of elevation change to point below sea level
        terrain.getElevationForLngLatZoom = () => -200;
        transform.recalculateZoom(terrain as any);
        expect(transform.elevation).toBe(-200);
        expect(transform.getCameraAltitude()).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(13.6895075574, 10);
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
});

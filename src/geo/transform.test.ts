import Point from '@mapbox/point-geometry';
import {MAX_VALID_LATITUDE, Transform} from './transform';
import {LngLat} from './lng_lat';
import {OverscaledTileID, CanonicalTileID} from '../source/tile_id';
import {fixedLngLat, fixedCoord} from '../../test/unit/lib/fixed';
import type {Terrain} from '../render/terrain';

describe('transform', () => {
    test('creates a transform', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        expect(transform.unmodified).toBe(true);
        expect(transform.tileSize).toBe(512);
        expect(transform.worldSize).toBe(512);
        expect(transform.width).toBe(500);
        expect(transform.minZoom).toBe(0);
        expect(transform.minPitch).toBe(0);
        // Support signed zero
        expect(transform.bearing === 0 ? 0 : transform.bearing).toBe(0);
        expect(transform.bearing = 1).toBe(1);
        expect(transform.bearing).toBe(1);
        expect(transform.bearing = 0).toBe(0);
        expect(transform.unmodified).toBe(false);
        expect(transform.minZoom = 10).toBe(10);
        expect(transform.maxZoom = 10).toBe(10);
        expect(transform.minZoom).toBe(10);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        expect(transform.maxZoom).toBe(10);
        expect(transform.minPitch = 10).toBe(10);
        expect(transform.maxPitch = 10).toBe(10);
        expect(transform.size.equals(new Point(500, 500))).toBe(true);
        expect(transform.centerPoint.equals(new Point(250, 250))).toBe(true);
        expect(transform.scaleZoom(0)).toBe(-Infinity);
        expect(transform.scaleZoom(10)).toBe(3.3219280948873626);
        expect(transform.point).toEqual(new Point(262144, 262144));
        expect(transform.height).toBe(500);
        expect(transform.nearZ).toBe(10);
        expect(transform.farZ).toBe(804.8028169246645);
        expect([...transform.projectionMatrix.values()]).toEqual([3, 0, 0, 0, 0, 3, 0, 0, -0, 0, -1.0251635313034058, -1, 0, 0, -20.25163459777832, 0]);
        expect([...transform.modelViewProjectionMatrix.values()]).toEqual([3, 0, 0, 0, 0, -2.954423259036624, -0.1780177690666898, -0.17364817766693033, 0, 0.006822967915294533, -0.013222891287479163, -0.012898324631281611, -786432, 774484.3308168967, 47414.91102496082, 46270.827886319785]);
        expect(fixedLngLat(transform.pointLocation(new Point(250, 250)))).toEqual({lng: 0, lat: 0});
        expect(fixedCoord(transform.pointCoordinate(new Point(250, 250)))).toEqual({x: 0.5, y: 0.5, z: 0});
        expect(transform.locationPoint(new LngLat(0, 0))).toEqual({x: 250, y: 250});
        expect(transform.locationCoordinate(new LngLat(0, 0))).toEqual({x: 0.5, y: 0.5, z: 0});
    });

    test('does not throw on bad center', () => {
        expect(() => {
            const transform = new Transform(0, 22, 0, 60, true);
            transform.resize(500, 500);
            transform.center = new LngLat(50, -90);
        }).not.toThrow();
    });

    test('setLocationAt', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        transform.zoom = 4;
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint(new LngLat(13, 10), new Point(15, 45));
        expect(fixedLngLat(transform.pointLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAt tilted', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        transform.zoom = 4;
        transform.pitch = 50;
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint(new LngLat(13, 10), new Point(15, 45));
        expect(fixedLngLat(transform.pointLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('has a default zoom', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        expect(transform.tileZoom).toBe(0);
        expect(transform.tileZoom).toBe(transform.zoom);
    });

    test('set zoom inits tileZoom with zoom value', () => {
        const transform = new Transform(0, 22, 0, 60);
        transform.zoom = 5;
        expect(transform.tileZoom).toBe(5);
    });

    test('set zoom clamps tileZoom to non negative value ', () => {
        const transform = new Transform(-2, 22, 0, 60);
        transform.zoom = -2;
        expect(transform.tileZoom).toBe(0);
    });

    test('set fov', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.fov = 10;
        expect(transform.fov).toBe(10);
        transform.fov = 10;
        expect(transform.fov).toBe(10);
    });

    test('lngRange & latRange constrain zoom and center', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.center = new LngLat(0, 0);
        transform.zoom = 10;
        transform.resize(500, 500);

        transform.lngRange = [-5, 5];
        transform.latRange = [-5, 5];

        transform.zoom = 0;
        expect(transform.zoom).toBe(5.1357092861044045);

        transform.center = new LngLat(-50, -30);
        expect(transform.center).toEqual(new LngLat(0, -0.0063583052861417855));

        transform.zoom = 10;
        transform.center = new LngLat(-50, -30);
        expect(transform.center).toEqual(new LngLat(-4.828338623046875, -4.828969771321582));
    });

    test('lngRange & latRange constrain zoom and center after cloning', () => {
        const old = new Transform(0, 22, 0, 60, true);
        old.center = new LngLat(0, 0);
        old.zoom = 10;
        old.resize(500, 500);

        old.lngRange = [-5, 5];
        old.latRange = [-5, 5];

        const transform = old.clone();

        transform.zoom = 0;
        expect(transform.zoom).toBe(5.1357092861044045);

        transform.center = new LngLat(-50, -30);
        expect(transform.center).toEqual(new LngLat(0, -0.0063583052861417855));

        transform.zoom = 10;
        transform.center = new LngLat(-50, -30);
        expect(transform.center).toEqual(new LngLat(-4.828338623046875, -4.828969771321582));
    });

    test('lngRange can constrain zoom and center across meridian', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.center = new LngLat(180, 0);
        transform.zoom = 10;
        transform.resize(500, 500);

        // equivalent ranges
        const lngRanges: [number, number][] = [
            [175, -175], [175, 185], [-185, -175], [-185, 185]
        ];

        for (const lngRange of lngRanges) {
            transform.lngRange = lngRange;
            transform.latRange = [-5, 5];

            transform.zoom = 0;
            expect(transform.zoom).toBe(5.1357092861044045);

            transform.center = new LngLat(-50, -30);
            expect(transform.center).toEqual(new LngLat(180, -0.0063583052861417855));

            transform.zoom = 10;
            transform.center = new LngLat(-50, -30);
            expect(transform.center).toEqual(new LngLat(-175.171661376953125, -4.828969771321582));

            transform.center = new LngLat(230, 0);
            expect(transform.center).toEqual(new LngLat(-175.171661376953125, 0));

            transform.center = new LngLat(130, 0);
            expect(transform.center).toEqual(new LngLat(175.171661376953125, 0));
        }
    });

    describe('coveringTiles', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(200, 200);

        test('general', () => {

            // make slightly off center so that sort order is not subject to precision issues
            transform.center = new LngLat(-0.01, 0.01);

            transform.zoom = 0;
            expect(transform.coveringTiles(options)).toEqual([]);

            transform.zoom = 1;
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 1, 0),
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, 0, 1, 1, 1)]);

            transform.zoom = 2.4;
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, 0, 2, 1, 1),
                new OverscaledTileID(2, 0, 2, 2, 1),
                new OverscaledTileID(2, 0, 2, 1, 2),
                new OverscaledTileID(2, 0, 2, 2, 2)]);

            transform.zoom = 10;
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(10, 0, 10, 511, 511),
                new OverscaledTileID(10, 0, 10, 512, 511),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512)]);

            transform.zoom = 11;
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(10, 0, 10, 511, 511),
                new OverscaledTileID(10, 0, 10, 512, 511),
                new OverscaledTileID(10, 0, 10, 511, 512),
                new OverscaledTileID(10, 0, 10, 512, 512)]);

            transform.zoom = 5.1;
            transform.pitch = 60.0;
            transform.bearing = 32.0;
            transform.center = new LngLat(56.90, 48.20);
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

            transform.zoom = 8;
            transform.pitch = 60;
            transform.bearing = 45.0;
            transform.center = new LngLat(25.02, 60.15);
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

            transform.zoom = 2;
            transform.pitch = 0;
            transform.bearing = 0;
            transform.resize(300, 300);
        });

        test('calculates tile coverage at w > 0', () => {
            transform.center = new LngLat(630.01, 0.01);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, 2, 2, 1, 1),
                new OverscaledTileID(2, 2, 2, 1, 2),
                new OverscaledTileID(2, 2, 2, 0, 1),
                new OverscaledTileID(2, 2, 2, 0, 2)
            ]);
        });

        test('calculates tile coverage at w = -1', () => {
            transform.center = new LngLat(-360.01, 0.01);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, -1, 2, 1, 1),
                new OverscaledTileID(2, -1, 2, 1, 2),
                new OverscaledTileID(2, -1, 2, 2, 1),
                new OverscaledTileID(2, -1, 2, 2, 2)
            ]);
        });

        test('calculates tile coverage across meridian', () => {
            transform.zoom = 1;
            transform.center = new LngLat(-180.01, 0.01);
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, -1, 1, 1, 0),
                new OverscaledTileID(1, -1, 1, 1, 1)
            ]);
        });

        test('only includes tiles for a single world, if renderWorldCopies is set to false', () => {
            transform.zoom = 1;
            transform.center = new LngLat(-180.01, 0.01);
            transform.renderWorldCopies = false;
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

        const transform = new Transform(0, 22, 0, 60, true);

        transform.zoom = 0;
        expect(transform.coveringZoomLevel(options)).toBe(0);

        transform.zoom = 0.1;
        expect(transform.coveringZoomLevel(options)).toBe(0);

        transform.zoom = 1;
        expect(transform.coveringZoomLevel(options)).toBe(1);

        transform.zoom = 2.4;
        expect(transform.coveringZoomLevel(options)).toBe(2);

        transform.zoom = 10;
        expect(transform.coveringZoomLevel(options)).toBe(10);

        transform.zoom = 11;
        expect(transform.coveringZoomLevel(options)).toBe(11);

        transform.zoom = 11.5;
        expect(transform.coveringZoomLevel(options)).toBe(11);

        options.tileSize = 256;

        transform.zoom = 0;
        expect(transform.coveringZoomLevel(options)).toBe(1);

        transform.zoom = 0.1;
        expect(transform.coveringZoomLevel(options)).toBe(1);

        transform.zoom = 1;
        expect(transform.coveringZoomLevel(options)).toBe(2);

        transform.zoom = 2.4;
        expect(transform.coveringZoomLevel(options)).toBe(3);

        transform.zoom = 10;
        expect(transform.coveringZoomLevel(options)).toBe(11);

        transform.zoom = 11;
        expect(transform.coveringZoomLevel(options)).toBe(12);

        transform.zoom = 11.5;
        expect(transform.coveringZoomLevel(options)).toBe(12);

        options.roundZoom = true;

        expect(transform.coveringZoomLevel(options)).toBe(13);
    });

    test('clamps latitude', () => {
        const transform = new Transform(0, 22, 0, 60, true);

        expect(transform.project(new LngLat(0, -90))).toEqual(transform.project(new LngLat(0, -MAX_VALID_LATITUDE)));
        expect(transform.project(new LngLat(0, 90))).toEqual(transform.project(new LngLat(0, MAX_VALID_LATITUDE)));
    });

    test('clamps pitch', () => {
        const transform = new Transform(0, 22, 0, 60, true);

        transform.pitch = 45;
        expect(transform.pitch).toBe(45);

        transform.pitch = -10;
        expect(transform.pitch).toBe(0);

        transform.pitch = 90;
        expect(transform.pitch).toBe(60);
    });

    test('visibleUnwrappedCoordinates', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(200, 200);
        transform.zoom = 0;
        transform.center = new LngLat(-170.01, 0.01);

        let unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        expect(unwrappedCoords).toHaveLength(4);

        //getVisibleUnwrappedCoordinates should honor _renderWorldCopies
        transform._renderWorldCopies = false;
        unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        expect(unwrappedCoords).toHaveLength(1);
    });

    test('maintains high float precision when calculating matrices', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(200.25, 200.25);
        transform.zoom = 20.25;
        transform.pitch = 67.25;
        transform.center = new LngLat(0.0, 0.0);
        transform._calcMatrices();

        expect(transform.customLayerMatrix()[0].toString().length).toBeGreaterThan(10);
        expect(transform.glCoordMatrix[0].toString().length).toBeGreaterThan(10);
        expect(transform.maxPitchScaleFactor()).toBeCloseTo(2.366025418080343, 5);
    });

    test('recalculateZoom', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.elevation = 200;
        transform.center = new LngLat(10.0, 50.0);
        transform.zoom = 14;
        transform.pitch = 45;
        transform.resize(512, 512);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(transform.getCameraPosition().altitude).toBeCloseTo(expectedAltitude, 10);

        // expect same values because of no elevation change
        const terrain = {
            getElevationForLngLatZoom: () => 200,
            pointCoordinate: () => null
        };
        transform.recalculateZoom(terrain as any);
        expect(transform.getCameraPosition().altitude).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBe(14);

        // expect new zoom because of elevation change
        terrain.getElevationForLngLatZoom = () => 400;
        transform.recalculateZoom(terrain as any);
        expect(transform.elevation).toBe(400);
        expect(transform._center.lng).toBeCloseTo(10, 10);
        expect(transform._center.lat).toBeCloseTo(50, 10);
        expect(transform.getCameraPosition().altitude).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(14.1845318986, 10);

        // expect new zoom because of elevation change to point below sea level
        terrain.getElevationForLngLatZoom = () => -200;
        transform.recalculateZoom(terrain as any);
        expect(transform.elevation).toBe(-200);
        expect(transform.getCameraPosition().altitude).toBeCloseTo(expectedAltitude, 10);
        expect(transform.zoom).toBeCloseTo(13.6895075574, 10);
    });

    test('pointCoordinate with terrain when returning null should fall back to 2D', () => {
        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        const terrain = {
            pointCoordinate: () => null
        } as any as Terrain;
        const coordinate = transform.pointCoordinate(new Point(0, 0), terrain);

        expect(coordinate).toBeDefined();
    });

    test('horizon', () => {
        const transform = new Transform(0, 22, 0, 85, true);
        transform.resize(500, 500);
        transform.pitch = 75;
        const horizon = transform.getHorizon();

        expect(horizon).toBeCloseTo(170.8176101748407, 10);
    });

    test('getBounds with horizon', () => {
        const transform = new Transform(0, 22, 0, 85, true);
        transform.resize(500, 500);

        transform.pitch = 60;
        expect(transform.getBounds().getNorthWest().toArray()).toStrictEqual(transform.pointLocation(new Point(0, 0)).toArray());

        transform.pitch = 75;
        const top = Math.max(0, transform.height / 2 - transform.getHorizon());
        expect(top).toBeCloseTo(79.1823898251593, 10);
        expect(transform.getBounds().getNorthWest().toArray()).toStrictEqual(transform.pointLocation(new Point(0, top)).toArray());
    });

    test('lngLatToCameraDepth', () => {
        const transform = new Transform(0, 22, 0, 85, true);
        transform.resize(500, 500);
        transform.center = new LngLat(10.0, 50.0);

        expect(transform.lngLatToCameraDepth(new LngLat(10, 50), 4)).toBeCloseTo(0.9997324396231673);
        transform.pitch = 60;
        expect(transform.lngLatToCameraDepth(new LngLat(10, 50), 4)).toBeCloseTo(0.9865782165762236);

    });
});

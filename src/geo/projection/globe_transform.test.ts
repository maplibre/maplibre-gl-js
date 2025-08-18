import {describe, expect, test} from 'vitest';
import {EXTENT} from '../../data/extent';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {GlobeTransform} from './globe_transform';
import {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../../source/tile_id';
import {angularCoordinatesRadiansToVector, mercatorCoordinatesToAngularCoordinatesRadians, sphereSurfacePointToCoordinates} from './globe_utils';
import {expectToBeCloseToArray} from '../../util/test/util';
import {MercatorCoordinate} from '../mercator_coordinate';
import {tileCoordinatesToLocation} from './mercator_utils';
import {MercatorTransform} from './mercator_transform';
import {globeConstants} from './vertical_perspective_projection';

function testPlaneAgainstLngLat(lngDegrees: number, latDegrees: number, plane: Array<number>) {
    const lat = latDegrees / 180.0 * Math.PI;
    const lng = lngDegrees / 180.0 * Math.PI;
    const len = Math.cos(lat);
    const pointOnSphere = [
        Math.sin(lng) * len,
        Math.sin(lat),
        Math.cos(lng) * len
    ];
    return planeDistance(pointOnSphere, plane);
}

function planeDistance(point: Array<number>, plane: Array<number>) {
    return point[0] * plane[0] + point[1] * plane[1] + point[2] * plane[2] + plane[3];
}

function createGlobeTransform() {
    const globeTransform = new GlobeTransform();
    globeTransform.resize(640, 480);
    globeTransform.setFov(45);
    return globeTransform;
}

describe('GlobeTransform', () => {
    // Force faster animations so we can use shorter sleeps when testing them
    globeConstants.errorTransitionTimeSeconds = 0.1;

    describe('getProjectionData', () => {
        const globeTransform = createGlobeTransform();
        test('mercator tile extents are set', () => {
            const projectionData = globeTransform.getProjectionData({overscaledTileID: new OverscaledTileID(1, 0, 1, 1, 0)});
            expectToBeCloseToArray(projectionData.tileMercatorCoords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });

        test('Globe transition is 0 when not applying the globe matrix', () => {
            const projectionData = globeTransform.getProjectionData({overscaledTileID: new OverscaledTileID(1, 0, 1, 1, 0)});
            expect(projectionData.projectionTransition).toBe(0);
        });

        test('Applying the globe matrix sets transition to something different than 0', () => {
            const projectionData = globeTransform.getProjectionData({overscaledTileID: new OverscaledTileID(1, 0, 1, 1, 0), applyGlobeMatrix: true});
            expect(projectionData.projectionTransition).not.toBe(0);
        });
    });

    describe('clipping plane', () => {
        const globeTransform = createGlobeTransform();

        describe('general plane properties', () => {
            const projectionData = globeTransform.getProjectionData({overscaledTileID: new OverscaledTileID(0, 0, 0, 0, 0)});

            test('plane vector length <= 1 so they are not clipped by the near plane.', () => {
                const len = Math.sqrt(
                    projectionData.clippingPlane[0] * projectionData.clippingPlane[0] +
                    projectionData.clippingPlane[1] * projectionData.clippingPlane[1] +
                    projectionData.clippingPlane[2] * projectionData.clippingPlane[2]
                );
                expect(len).toBeLessThanOrEqual(1);
            });

            test('camera is in positive halfspace', () => {
                expect(planeDistance(globeTransform.cameraPosition as [number, number, number], projectionData.clippingPlane)).toBeGreaterThan(0);
            });

            test('coordinates 0E,0N are in positive halfspace', () => {
                expect(testPlaneAgainstLngLat(0, 0, projectionData.clippingPlane)).toBeGreaterThan(0);
            });

            test('coordinates 40E,0N are in positive halfspace', () => {
                expect(testPlaneAgainstLngLat(40, 0, projectionData.clippingPlane)).toBeGreaterThan(0);
            });

            test('coordinates 0E,90N are in negative halfspace', () => {
                expect(testPlaneAgainstLngLat(0, 90, projectionData.clippingPlane)).toBeLessThan(0);
            });

            test('coordinates 90E,0N are in negative halfspace', () => {
                expect(testPlaneAgainstLngLat(90, 0, projectionData.clippingPlane)).toBeLessThan(0);
            });

            test('coordinates 180E,0N are in negative halfspace', () => {
                expect(testPlaneAgainstLngLat(180, 0, projectionData.clippingPlane)).toBeLessThan(0);
            });
        });
    });

    describe('projection', () => {
        test('mercator coordinate to sphere point', () => {
            const precisionDigits = 10;

            let projectedAngles;
            let projected;

            projectedAngles = mercatorCoordinatesToAngularCoordinatesRadians(0.5, 0.5);
            expectToBeCloseToArray(projectedAngles, [0, 0], precisionDigits);
            projected = angularCoordinatesRadiansToVector(projectedAngles[0], projectedAngles[1]) as [number, number, number];
            expectToBeCloseToArray(projected, [0, 0, 1], precisionDigits);

            projectedAngles = mercatorCoordinatesToAngularCoordinatesRadians(0, 0.5);
            expectToBeCloseToArray(projectedAngles, [Math.PI, 0], precisionDigits);
            projected = angularCoordinatesRadiansToVector(projectedAngles[0], projectedAngles[1]) as [number, number, number];
            expectToBeCloseToArray(projected, [0, 0, -1], precisionDigits);

            projectedAngles = mercatorCoordinatesToAngularCoordinatesRadians(0.75, 0.5);
            expectToBeCloseToArray(projectedAngles, [Math.PI / 2.0, 0], precisionDigits);
            projected = angularCoordinatesRadiansToVector(projectedAngles[0], projectedAngles[1]) as [number, number, number];
            expectToBeCloseToArray(projected, [1, 0, 0], precisionDigits);

            projectedAngles = mercatorCoordinatesToAngularCoordinatesRadians(0.5, 0);
            expectToBeCloseToArray(projectedAngles, [0, 1.4844222297453324], precisionDigits); // ~0.47pi
            projected = angularCoordinatesRadiansToVector(projectedAngles[0], projectedAngles[1]) as [number, number, number];
            expectToBeCloseToArray(projected, [0, 0.99627207622075, 0.08626673833405434], precisionDigits);
        });

        test('camera position', () => {
            const precisionDigits = 10;

            const globeTransform = createGlobeTransform();
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [0, 0, 8.110445867263898], precisionDigits);

            globeTransform.resize(512, 512);
            globeTransform.setZoom(-0.5);
            globeTransform.setCenter(new LngLat(0, 80));
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [0, 2.2818294674820794, 0.40234810049271963], precisionDigits);

            globeTransform.setPitch(35);
            globeTransform.setBearing(70);
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [-0.7098603286961542, 2.002400604307631, 0.6154310261827212], precisionDigits);

            globeTransform.setPitch(35);
            globeTransform.setBearing(70);
            globeTransform.setRoll(40);
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [-0.7098603286961542, 2.002400604307631, 0.6154310261827212], precisionDigits);

            globeTransform.setPitch(35);
            globeTransform.setBearing(70);
            globeTransform.setRoll(180);
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [-0.7098603286961542, 2.002400604307631, 0.6154310261827212], precisionDigits);

            globeTransform.setCenter(new LngLat(-10, 42));
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [-3.8450970996236364, 2.9368285470351516, 4.311953269048194], precisionDigits);
        });

        test('sphere point to coordinate', () => {
            const precisionDigits = 10;
            let unprojected = sphereSurfacePointToCoordinates([0, 0, 1]) as LngLat;
            expect(unprojected.lng).toBeCloseTo(0, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(0, precisionDigits);
            unprojected = sphereSurfacePointToCoordinates([0, 1, 0]) as LngLat;
            expect(unprojected.lng).toBeCloseTo(0, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(90, precisionDigits);
            unprojected = sphereSurfacePointToCoordinates([1, 0, 0]) as LngLat;
            expect(unprojected.lng).toBeCloseTo(90, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(0, precisionDigits);
        });

        const screenCenter = new Point(640 / 2, 480 / 2); // We need the exact screen center
        const screenTopEdgeCenter = new Point(640 / 2, 0);

        describe('project location to coordinates', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform();

            test('basic test', () => {
                globeTransform.setCenter(new LngLat(0, 0));
                let projected = globeTransform.locationToScreenPoint(globeTransform.center);
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);

                globeTransform.setCenter(new LngLat(70, 50));
                projected = globeTransform.locationToScreenPoint(globeTransform.center);
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);

                globeTransform.setCenter(new LngLat(0, 84));
                projected = globeTransform.locationToScreenPoint(globeTransform.center);
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);
            });

            test('project a location that is slightly above and below map\'s center point', () => {
                globeTransform.setCenter(new LngLat(0, 0));
                let projected = globeTransform.locationToScreenPoint(new LngLat(0, 1));
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeLessThan(screenCenter.y);

                projected = globeTransform.locationToScreenPoint(new LngLat(0, -1));
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeGreaterThan(screenCenter.y);
            });
        });

        describe('unproject', () => {
            test('unproject screen center', () => {
                const precisionDigits = 10;
                const globeTransform = createGlobeTransform();
                let unprojected = globeTransform.screenPointToLocation(screenCenter);
                expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);

                globeTransform.setCenter(new LngLat(90.0, 0.0));
                unprojected = globeTransform.screenPointToLocation(screenCenter);
                expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);

                globeTransform.setCenter(new LngLat(0.0, 60.0));
                unprojected = globeTransform.screenPointToLocation(screenCenter);
                expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);
            });

            test('unproject point to the side', () => {
                const precisionDigits = 10;
                const globeTransform = createGlobeTransform();
                let coords: LngLat;
                let projected: Point;
                let unprojected: LngLat;

                coords = new LngLat(0, 0);
                projected = globeTransform.locationToScreenPoint(coords);
                unprojected = globeTransform.screenPointToLocation(projected);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);

                coords = new LngLat(10, 20);
                projected = globeTransform.locationToScreenPoint(coords);
                unprojected = globeTransform.screenPointToLocation(projected);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);

                coords = new LngLat(15, -2);
                projected = globeTransform.locationToScreenPoint(coords);
                unprojected = globeTransform.screenPointToLocation(projected);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            });

            test('unproject behind the pole', () => {
                // This test tries to unproject a point that is beyond the north pole
                // from the camera's point of view.
                // This particular case turned out to be problematic, hence this test.

                const precisionDigits = 10;
                const globeTransform = createGlobeTransform();
                // Transform settings from the render test projection/globe/fill-planet-pole
                // See the expected result for how the globe should look with this transform.
                globeTransform.resize(512, 512);
                globeTransform.setZoom(-0.5);
                globeTransform.setCenter(new LngLat(0, 80));

                let coords: LngLat;
                let projected: Point;
                let unprojected: LngLat;

                coords = new LngLat(179.9, 71);
                projected = globeTransform.locationToScreenPoint(coords);
                unprojected = globeTransform.screenPointToLocation(projected);
                expect(projected.x).toBeCloseTo(256.2434702034287, precisionDigits);
                expect(projected.y).toBeCloseTo(48.27080146399297, precisionDigits);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);

                // Near the pole
                coords = new LngLat(179.9, 89.0);
                projected = globeTransform.locationToScreenPoint(coords);
                unprojected = globeTransform.screenPointToLocation(projected);
                expect(projected.x).toBeCloseTo(256.0140972925064, precisionDigits);
                expect(projected.y).toBeCloseTo(167.69159699932908, precisionDigits);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            });

            test('unproject outside of sphere', () => {
                const precisionDigits = 10;
                const globeTransform = createGlobeTransform();
                // Try unprojection a point somewhere above the western horizon
                globeTransform.setPitch(60);
                globeTransform.setBearing(-90);
                const unprojected = globeTransform.screenPointToLocation(screenTopEdgeCenter);
                expect(unprojected.lng).toBeCloseTo(-28.990298145461963, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(0.0, precisionDigits);
            });

            test('unproject further outside of sphere clamps to horizon', () => {
                const globeTransform = createGlobeTransform();
                globeTransform.setPitch(60);
                globeTransform.setBearing(-90);
                const screenPointAboveWesternHorizon = screenTopEdgeCenter;
                const screenPointFurtherAboveWesternHorizon = screenTopEdgeCenter.sub(new Point(0, -100));
                const unprojected = globeTransform.screenPointToLocation(screenPointAboveWesternHorizon);
                const unprojected2 = globeTransform.screenPointToLocation(screenPointFurtherAboveWesternHorizon);
                expect(unprojected.lat).toBeCloseTo(unprojected2.lat, 10);
                expect(unprojected.lng).toBeCloseTo(unprojected2.lng, 10);
            });
        });

        describe('setLocationAtPoint', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform();
            globeTransform.setZoom(1);
            let coords: LngLat;
            let point: Point;
            let projected: Point;
            let unprojected: LngLat;

            test('identity', () => {
                // Should do nothing
                coords = new LngLat(0, 0);
                point = new Point(320, 240);
                globeTransform.setLocationAtPoint(coords, point);
                unprojected = globeTransform.screenPointToLocation(point);
                projected = globeTransform.locationToScreenPoint(coords);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
                expect(projected.x).toBeCloseTo(point.x, precisionDigits);
                expect(projected.y).toBeCloseTo(point.y, precisionDigits);
            });

            test('offset lnglat', () => {
                coords = new LngLat(5, 10);
                point = new Point(320, 240);
                globeTransform.setLocationAtPoint(coords, point);
                unprojected = globeTransform.screenPointToLocation(point);
                projected = globeTransform.locationToScreenPoint(coords);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
                expect(projected.x).toBeCloseTo(point.x, precisionDigits);
                expect(projected.y).toBeCloseTo(point.y, precisionDigits);
            });

            test('offset pixel + lnglat', () => {
                coords = new LngLat(5, 10);
                point = new Point(330, 240); // 10 pixels to the right
                globeTransform.setLocationAtPoint(coords, point);
                unprojected = globeTransform.screenPointToLocation(point);
                projected = globeTransform.locationToScreenPoint(coords);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
                expect(projected.x).toBeCloseTo(point.x, precisionDigits);
                expect(projected.y).toBeCloseTo(point.y, precisionDigits);
            });

            test('larger offset', () => {
                coords = new LngLat(30, -2);
                point = new Point(250, 180);
                globeTransform.setLocationAtPoint(coords, point);
                unprojected = globeTransform.screenPointToLocation(point);
                projected = globeTransform.locationToScreenPoint(coords);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
                expect(projected.x).toBeCloseTo(point.x, precisionDigits);
                expect(projected.y).toBeCloseTo(point.y, precisionDigits);
            });

            describe('rotated', () => {
                globeTransform.setBearing(90);

                test('identity', () => {
                    // Should do nothing
                    coords = new LngLat(0, 0);
                    point = new Point(320, 240);
                    globeTransform.setLocationAtPoint(coords, point);
                    unprojected = globeTransform.screenPointToLocation(point);
                    projected = globeTransform.locationToScreenPoint(coords);
                    expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                    expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
                    expect(projected.x).toBeCloseTo(point.x, precisionDigits);
                    expect(projected.y).toBeCloseTo(point.y, precisionDigits);
                });
                test('offset lnglat', () => {
                    coords = new LngLat(5, 0);
                    point = new Point(320, 240);
                    globeTransform.setLocationAtPoint(coords, point);
                    unprojected = globeTransform.screenPointToLocation(point);
                    projected = globeTransform.locationToScreenPoint(coords);
                    expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                    expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
                    expect(projected.x).toBeCloseTo(point.x, precisionDigits);
                    expect(projected.y).toBeCloseTo(point.y, precisionDigits);
                });
                test('offset pixel + lnglat', () => {
                    coords = new LngLat(0, 10);
                    point = new Point(350, 240); // 30 pixels to the right
                    globeTransform.setLocationAtPoint(coords, point);
                    unprojected = globeTransform.screenPointToLocation(point);
                    projected = globeTransform.locationToScreenPoint(coords);
                    expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                    expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
                    expect(projected.x).toBeCloseTo(point.x, precisionDigits);
                    expect(projected.y).toBeCloseTo(point.y, precisionDigits);
                    expect(globeTransform.center.lat).toBeCloseTo(20.659450722109348, precisionDigits);
                });
            });
        });
    });

    describe('isPointOnMapSurface', () => {
        const globeTransform = new GlobeTransform();
        globeTransform.resize(640, 480);
        globeTransform.setZoom(1);

        test('Top screen edge', () => {
            expect(globeTransform.isPointOnMapSurface(new Point(320, 0))).toBe(false);
        });

        test('Screen center', () => {
            expect(globeTransform.isPointOnMapSurface(new Point(320, 240))).toBe(true);
        });

        test('Top', () => {
            expect(globeTransform.isPointOnMapSurface(new Point(320, 104))).toBe(false);
            expect(globeTransform.isPointOnMapSurface(new Point(320, 105))).toBe(true);
        });

        test('Bottom', () => {
            expect(globeTransform.isPointOnMapSurface(new Point(320, 480 - 105))).toBe(true);
            expect(globeTransform.isPointOnMapSurface(new Point(320, 480 - 104))).toBe(false);
        });

        test('Left', () => {
            expect(globeTransform.isPointOnMapSurface(new Point(184, 240))).toBe(false);
            expect(globeTransform.isPointOnMapSurface(new Point(185, 240))).toBe(true);
        });

        test('Right', () => {
            expect(globeTransform.isPointOnMapSurface(new Point(640 - 185, 240))).toBe(true);
            expect(globeTransform.isPointOnMapSurface(new Point(640 - 184, 240))).toBe(false);
        });

        test('Diagonal', () => {
            expect(globeTransform.isPointOnMapSurface(new Point(223, 147))).toBe(true);
            expect(globeTransform.isPointOnMapSurface(new Point(221, 144))).toBe(false);
        });
    });

    test('pointCoordinate', () => {
        const precisionDigits = 10;
        const globeTransform = createGlobeTransform();
        let coords: LngLat;
        let coordsMercator: MercatorCoordinate;
        let projected: Point;
        let unprojectedCoordinates: MercatorCoordinate;

        coords = new LngLat(0, 0);
        coordsMercator = MercatorCoordinate.fromLngLat(coords);
        projected = globeTransform.locationToScreenPoint(coords);
        unprojectedCoordinates = globeTransform.screenPointToMercatorCoordinate(projected);
        expect(unprojectedCoordinates.x).toBeCloseTo(coordsMercator.x, precisionDigits);
        expect(unprojectedCoordinates.y).toBeCloseTo(coordsMercator.y, precisionDigits);

        coords = new LngLat(10, 20);
        coordsMercator = MercatorCoordinate.fromLngLat(coords);
        projected = globeTransform.locationToScreenPoint(coords);
        unprojectedCoordinates = globeTransform.screenPointToMercatorCoordinate(projected);
        expect(unprojectedCoordinates.x).toBeCloseTo(coordsMercator.x, precisionDigits);
        expect(unprojectedCoordinates.y).toBeCloseTo(coordsMercator.y, precisionDigits);
    });

    describe('getBounds', () => {
        const precisionDigits = 10;

        const globeTransform = new GlobeTransform();
        globeTransform.resize(640, 480);

        test('basic', () => {
            globeTransform.setCenter(new LngLat(0, 0));
            globeTransform.setZoom(1);
            const bounds = globeTransform.getBounds();
            expect(bounds._ne.lat).toBeCloseTo(79.3636705287052, precisionDigits);
            expect(bounds._ne.lng).toBeCloseTo(79.36367052870514, precisionDigits);
            expect(bounds._sw.lat).toBeCloseTo(-79.3636705287052, precisionDigits);
            expect(bounds._sw.lng).toBeCloseTo(-79.3636705287052, precisionDigits);
        });

        test('zoomed in', () => {
            globeTransform.setCenter(new LngLat(0, 0));
            globeTransform.setZoom(4);
            const bounds = globeTransform.getBounds();
            expect(bounds._ne.lat).toBeCloseTo(11.76627084591695, precisionDigits);
            expect(bounds._ne.lng).toBeCloseTo(16.124697669965144, precisionDigits);
            expect(bounds._sw.lat).toBeCloseTo(-11.76627084591695, precisionDigits);
            expect(bounds._sw.lng).toBeCloseTo(-16.124697669965144, precisionDigits);
        });

        test('looking at south pole', () => {
            globeTransform.setCenter(new LngLat(0, -84));
            globeTransform.setZoom(-2);
            const bounds = globeTransform.getBounds();
            expect(bounds._ne.lat).toBeCloseTo(-6.299534770946991, precisionDigits);
            expect(bounds._ne.lng).toBeCloseTo(180, precisionDigits);
            expect(bounds._sw.lat).toBeCloseTo(-90, precisionDigits);
            expect(bounds._sw.lng).toBeCloseTo(-180, precisionDigits);
        });

        test('looking at south edge of mercator', () => {
            globeTransform.setCenter(new LngLat(-163, -83));
            globeTransform.setZoom(3);
            const bounds = globeTransform.getBounds();
            expect(bounds._ne.lat).toBeCloseTo(-79.75570418234764, precisionDigits);
            expect(bounds._ne.lng).toBeCloseTo(-124.19771985801174, precisionDigits);
            expect(bounds._sw.lat).toBeCloseTo(-85.59109073899032, precisionDigits);
            expect(bounds._sw.lng).toBeCloseTo(-201.80228014198985, precisionDigits);
        });
    });

    describe('projectTileCoordinates', () => {
        const precisionDigits = 10;
        const transform = new GlobeTransform();
        transform.resize(512, 512);
        transform.setCenter(new LngLat(10.0, 50.0));
        transform.setZoom(-1);

        test('basic', () => {

            const projection = transform.projectTileCoordinates(1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), (_x, _y) => 0);
            expect(projection.point.x).toBeCloseTo(0.008635590705360347, precisionDigits);
            expect(projection.point.y).toBeCloseTo(0.16970500709841846, precisionDigits);
            expect(projection.signedDistanceFromCamera).toBeCloseTo(781.0549201758624, precisionDigits);
            expect(projection.isOccluded).toBe(false);
        });

        test('rotated', () => {
            transform.setBearing(12);
            transform.setPitch(10);

            const projection = transform.projectTileCoordinates(1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), (_x, _y) => 0);
            expect(projection.point.x).toBeCloseTo(-0.026585319983152694, precisionDigits);
            expect(projection.point.y).toBeCloseTo(0.15506884411121183, precisionDigits);
            expect(projection.signedDistanceFromCamera).toBeCloseTo(788.4423931260653, precisionDigits);
            expect(projection.isOccluded).toBe(false);
        });

        test('occluded by planet', () => {
            transform.setBearing(-90);
            transform.setPitch(60);

            const projection = transform.projectTileCoordinates(8192, 8192, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), (_x, _y) => 0);
            expect(projection.point.x).toBeCloseTo(0.22428309892086878, precisionDigits);
            expect(projection.point.y).toBeCloseTo(-0.4462620847133465, precisionDigits);
            expect(projection.signedDistanceFromCamera).toBeCloseTo(822.280942015371, precisionDigits);
            expect(projection.isOccluded).toBe(true);
        });
    });

    describe('isLocationOccluded', () => {
        const transform = new GlobeTransform();
        transform.resize(512, 512);
        transform.setCenter(new LngLat(0.0, 0.0));
        transform.setZoom(-1);

        test('center', () => {
            expect(transform.isLocationOccluded(new LngLat(0, 0))).toBe(false);
        });

        test('center from tile', () => {
            expect(transform.isLocationOccluded(tileCoordinatesToLocation(0, 0, new CanonicalTileID(1, 1, 1)))).toBe(false);
        });

        test('backside', () => {
            expect(transform.isLocationOccluded(new LngLat(179.9, 0))).toBe(true);
        });

        test('backside from tile', () => {
            expect(transform.isLocationOccluded(tileCoordinatesToLocation(0, 0, new CanonicalTileID(1, 0, 1)))).toBe(true);
        });

        test('barely visible', () => {
            expect(transform.isLocationOccluded(new LngLat(84.49, 0))).toBe(false);
        });

        test('barely hidden', () => {
            expect(transform.isLocationOccluded(new LngLat(84.50, 0))).toBe(true);
        });
    });

    describe('render world copies', () => {
        test('change projection and make sure render world copies is kept', () => {
            const globeTransform = createGlobeTransform();
            globeTransform.setRenderWorldCopies(true);
            
            expect(globeTransform.renderWorldCopies).toBeTruthy();
        });

        test('change transform and make sure render world copies is kept', () => {
            const globeTransform = createGlobeTransform();
            globeTransform.setRenderWorldCopies(true);
            const mercator = new MercatorTransform(0, 1, 2, 3, false);
            mercator.apply(globeTransform);

            expect(mercator.renderWorldCopies).toBeTruthy();
        });
    });
});

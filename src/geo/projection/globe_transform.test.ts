import {GlobeProjection} from './globe';
import {EXTENT} from '../../data/extent';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {GlobeTransform} from './globe_transform';
import {OverscaledTileID} from '../../source/tile_id';
import {angularCoordinatesRadiansToVector, mercatorCoordinatesToAngularCoordinatesRadians, sphereSurfacePointToCoordinates} from './globe_utils';
import {expectToBeCloseToArray, sleep} from '../../util/test/util';
import {MercatorCoordinate} from '../mercator_coordinate';

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

function createGlobeTransform(globeProjection: GlobeProjection) {
    const globeTransform = new GlobeTransform(globeProjection);
    globeTransform.resize(640, 480);
    globeTransform.setFov(45);
    return globeTransform;
}

describe('GlobeTransform', () => {
    const globeProjectionMock = {
        get useGlobeControls(): boolean {
            return true;
        },
        get useGlobeRendering(): boolean {
            return true;
        },
        set useGlobeRendering(_value: boolean) {
            // do not set
        },
        latitudeErrorCorrectionRadians: 0,
        errorQueryLatitudeDegrees: 0,
    } as GlobeProjection;

    describe('getProjectionData', () => {
        const globeTransform = createGlobeTransform(globeProjectionMock);
        test('mercator tile extents are set', () => {
            const projectionData = globeTransform.getProjectionData(new OverscaledTileID(1, 0, 1, 1, 0));
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });
    });

    describe('clipping plane', () => {
        const globeTransform = createGlobeTransform(globeProjectionMock);

        describe('general plane properties', () => {
            globeTransform.newFrameUpdate();
            const projectionData = globeTransform.getProjectionData(new OverscaledTileID(0, 0, 0, 0, 0));

            test('plane vector length', () => {
                const len = Math.sqrt(
                    projectionData.u_projection_clipping_plane[0] * projectionData.u_projection_clipping_plane[0] +
                    projectionData.u_projection_clipping_plane[1] * projectionData.u_projection_clipping_plane[1] +
                    projectionData.u_projection_clipping_plane[2] * projectionData.u_projection_clipping_plane[2]
                );
                expect(len).toBeCloseTo(0.25);
            });

            test('camera is in positive halfspace', () => {
                expect(planeDistance(globeTransform.cameraPosition as [number, number, number], projectionData.u_projection_clipping_plane)).toBeGreaterThan(0);
            });

            test('coordinates 0E,0N are in positive halfspace', () => {
                expect(testPlaneAgainstLngLat(0, 0, projectionData.u_projection_clipping_plane)).toBeGreaterThan(0);
            });

            test('coordinates 40E,0N are in positive halfspace', () => {
                expect(testPlaneAgainstLngLat(40, 0, projectionData.u_projection_clipping_plane)).toBeGreaterThan(0);
            });

            test('coordinates 0E,90N are in negative halfspace', () => {
                expect(testPlaneAgainstLngLat(0, 90, projectionData.u_projection_clipping_plane)).toBeLessThan(0);
            });

            test('coordinates 90E,0N are in negative halfspace', () => {
                expect(testPlaneAgainstLngLat(90, 0, projectionData.u_projection_clipping_plane)).toBeLessThan(0);
            });

            test('coordinates 180E,0N are in negative halfspace', () => {
                expect(testPlaneAgainstLngLat(180, 0, projectionData.u_projection_clipping_plane)).toBeLessThan(0);
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

            const globeTransform = createGlobeTransform(globeProjectionMock);
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [0, 0, 8.110445867263898], precisionDigits);

            globeTransform.resize(512, 512);
            globeTransform.setZoom(-0.5);
            globeTransform.setCenter(new LngLat(0, 80));
            globeTransform.newFrameUpdate();
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [0, 2.2818294674820794, 0.40234810049271963], precisionDigits);

            globeTransform.setPitch(35);
            globeTransform.setBearing(70);
            globeTransform.newFrameUpdate();
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [-0.7098603286961542, 2.002400604307631, 0.6154310261827212], precisionDigits);

            globeTransform.setCenter(new LngLat(-10, 42));
            globeTransform.newFrameUpdate();
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
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.newFrameUpdate();

            test('basic test', () => {
                globeTransform.setCenter(new LngLat(0, 0));
                let projected = globeTransform.locationPoint(globeTransform.center);
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);

                globeTransform.setCenter(new LngLat(70, 50));
                projected = globeTransform.locationPoint(globeTransform.center);
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);

                globeTransform.setCenter(new LngLat(0, 84));
                projected = globeTransform.locationPoint(globeTransform.center);
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);
            });

            test('project a location that is slightly above and below map\'s center point', () => {
                globeTransform.setCenter(new LngLat(0, 0));
                let projected = globeTransform.locationPoint(new LngLat(0, 1));
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeLessThan(screenCenter.y);

                projected = globeTransform.locationPoint(new LngLat(0, -1));
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeGreaterThan(screenCenter.y);
            });
        });

        test('unproject screen center', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.newFrameUpdate();
            let unprojected = globeTransform.pointLocation(screenCenter);
            expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);

            globeTransform.center.lng = 90.0;
            globeTransform.newFrameUpdate();
            unprojected = globeTransform.pointLocation(screenCenter);
            expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);

            globeTransform.center.lng = 0.0;
            globeTransform.center.lat = 60.0;
            globeTransform.newFrameUpdate();
            unprojected = globeTransform.pointLocation(screenCenter);
            expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);
        });

        test('unproject point to the side', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.newFrameUpdate();
            let coords: LngLat;
            let projected: Point;
            let unprojected: LngLat;

            coords = new LngLat(0, 0);
            projected = globeTransform.locationPoint(coords);
            unprojected = globeTransform.pointLocation(projected);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);

            coords = new LngLat(10, 20);
            projected = globeTransform.locationPoint(coords);
            unprojected = globeTransform.pointLocation(projected);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);

            coords = new LngLat(15, -2);
            projected = globeTransform.locationPoint(coords);
            unprojected = globeTransform.pointLocation(projected);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
        });

        test('unproject behind the pole', () => {
            // This test tries to unproject a point that is beyond the north pole
            // from the camera's point of view.
            // This particular case turned out to be problematic, hence this test.

            const precisionDigits = 10;
            const globeTransform = createGlobeTransform(globeProjectionMock);
            // Transform settings from the render test projection/globe/fill-planet-pole
            // See the expected result for how the globe should look with this transform.
            globeTransform.resize(512, 512);
            globeTransform.setZoom(-0.5);
            globeTransform.setCenter(new LngLat(0, 80));
            globeTransform.newFrameUpdate();

            let coords: LngLat;
            let projected: Point;
            let unprojected: LngLat;

            coords = new LngLat(179.9, 71);
            projected = globeTransform.locationPoint(coords);
            unprojected = globeTransform.pointLocation(projected);
            expect(projected.x).toBeCloseTo(256.2434702034287, precisionDigits);
            expect(projected.y).toBeCloseTo(48.27080146399297, precisionDigits);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);

            // Near the pole
            coords = new LngLat(179.9, 89.0);
            projected = globeTransform.locationPoint(coords);
            unprojected = globeTransform.pointLocation(projected);
            expect(projected.x).toBeCloseTo(256.0140972925064, precisionDigits);
            expect(projected.y).toBeCloseTo(167.69159699932908, precisionDigits);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
        });

        test('unproject outside of sphere', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform(globeProjectionMock);
            // Try unprojection a point somewhere above the western horizon
            globeTransform.setPitch(60);
            globeTransform.setBearing(-90);
            globeTransform.newFrameUpdate();
            const unprojected = globeTransform.pointLocation(screenTopEdgeCenter);
            expect(unprojected.lng).toBeCloseTo(-34.699626794124015, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(0.0, precisionDigits);
        });

        test('setLocationAtPoint', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.setZoom(1);
            globeTransform.newFrameUpdate();
            let coords: LngLat;
            let point: Point;
            let projected: Point;
            let unprojected: LngLat;

            // Should do nothing
            coords = new LngLat(0, 0);
            point = new Point(320, 240);
            globeTransform.setLocationAtPoint(coords, point);
            unprojected = globeTransform.pointLocation(point);
            projected = globeTransform.locationPoint(coords);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            expect(projected.x).toBeCloseTo(point.x, precisionDigits);
            expect(projected.y).toBeCloseTo(point.y, precisionDigits);

            coords = new LngLat(5, 10);
            point = new Point(320, 240);
            globeTransform.setLocationAtPoint(coords, point);
            unprojected = globeTransform.pointLocation(point);
            projected = globeTransform.locationPoint(coords);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            expect(projected.x).toBeCloseTo(point.x, precisionDigits);
            expect(projected.y).toBeCloseTo(point.y, precisionDigits);

            coords = new LngLat(5, 10);
            point = new Point(330, 240); // 10 pixels to the right
            globeTransform.setLocationAtPoint(coords, point);
            unprojected = globeTransform.pointLocation(point);
            projected = globeTransform.locationPoint(coords);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            expect(projected.x).toBeCloseTo(point.x, precisionDigits);
            expect(projected.y).toBeCloseTo(point.y, precisionDigits);

            coords = new LngLat(30, -2);
            point = new Point(250, 180);
            globeTransform.setLocationAtPoint(coords, point);
            unprojected = globeTransform.pointLocation(point);
            projected = globeTransform.locationPoint(coords);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            expect(projected.x).toBeCloseTo(point.x, precisionDigits);
            expect(projected.y).toBeCloseTo(point.y, precisionDigits);
        });

        test('setLocationAtPoint rotated', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.setZoom(1);
            globeTransform.setBearing(90);
            globeTransform.newFrameUpdate();
            let coords: LngLat;
            let point: Point;
            let projected: Point;
            let unprojected: LngLat;

            // Should do nothing
            coords = new LngLat(0, 0);
            point = new Point(320, 240);
            globeTransform.setLocationAtPoint(coords, point);
            unprojected = globeTransform.pointLocation(point);
            projected = globeTransform.locationPoint(coords);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            expect(projected.x).toBeCloseTo(point.x, precisionDigits);
            expect(projected.y).toBeCloseTo(point.y, precisionDigits);

            coords = new LngLat(5, 0);
            point = new Point(320, 240);
            globeTransform.setLocationAtPoint(coords, point);
            unprojected = globeTransform.pointLocation(point);
            projected = globeTransform.locationPoint(coords);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            expect(projected.x).toBeCloseTo(point.x, precisionDigits);
            expect(projected.y).toBeCloseTo(point.y, precisionDigits);

            coords = new LngLat(0, 10);
            point = new Point(350, 240); // 30 pixels to the right
            globeTransform.setLocationAtPoint(coords, point);
            unprojected = globeTransform.pointLocation(point);
            projected = globeTransform.locationPoint(coords);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            expect(projected.x).toBeCloseTo(point.x, precisionDigits);
            expect(projected.y).toBeCloseTo(point.y, precisionDigits);
            expect(globeTransform.center.lat).toBeCloseTo(20.659450722109348, precisionDigits);
        });
    });

    test('isPointOnMapSurface', () => {
        const globeTransform = new GlobeTransform(globeProjectionMock);
        globeTransform.resize(640, 480);
        globeTransform.setZoom(1);
        // Top screen edge
        expect(globeTransform.isPointOnMapSurface(new Point(320, 0))).toBe(false);
        // Screen center
        expect(globeTransform.isPointOnMapSurface(new Point(320, 240))).toBe(true);
        // Top
        expect(globeTransform.isPointOnMapSurface(new Point(320, 104))).toBe(false);
        expect(globeTransform.isPointOnMapSurface(new Point(320, 105))).toBe(true);
        // Bottom
        expect(globeTransform.isPointOnMapSurface(new Point(320, 480 - 105))).toBe(true);
        expect(globeTransform.isPointOnMapSurface(new Point(320, 480 - 104))).toBe(false);
        // Left
        expect(globeTransform.isPointOnMapSurface(new Point(184, 240))).toBe(false);
        expect(globeTransform.isPointOnMapSurface(new Point(185, 240))).toBe(true);
        // Right
        expect(globeTransform.isPointOnMapSurface(new Point(640 - 185, 240))).toBe(true);
        expect(globeTransform.isPointOnMapSurface(new Point(640 - 184, 240))).toBe(false);
        // Diagonal
        expect(globeTransform.isPointOnMapSurface(new Point(223, 147))).toBe(true);
        expect(globeTransform.isPointOnMapSurface(new Point(221, 144))).toBe(false);
    });

    test('pointCoordinate', () => {
        const precisionDigits = 10;
        const globeTransform = createGlobeTransform(globeProjectionMock);
        globeTransform.newFrameUpdate();
        let coords: LngLat;
        let coordsMercator: MercatorCoordinate;
        let projected: Point;
        let unprojectedCoordinates: MercatorCoordinate;

        coords = new LngLat(0, 0);
        coordsMercator = MercatorCoordinate.fromLngLat(coords);
        projected = globeTransform.locationPoint(coords);
        unprojectedCoordinates = globeTransform.pointCoordinate(projected);
        expect(unprojectedCoordinates.x).toBeCloseTo(coordsMercator.x, precisionDigits);
        expect(unprojectedCoordinates.y).toBeCloseTo(coordsMercator.y, precisionDigits);

        coords = new LngLat(10, 20);
        coordsMercator = MercatorCoordinate.fromLngLat(coords);
        projected = globeTransform.locationPoint(coords);
        unprojectedCoordinates = globeTransform.pointCoordinate(projected);
        expect(unprojectedCoordinates.x).toBeCloseTo(coordsMercator.x, precisionDigits);
        expect(unprojectedCoordinates.y).toBeCloseTo(coordsMercator.y, precisionDigits);
    });

    describe('globeViewAllowed', () => {
        test('starts enabled', async () => {
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.newFrameUpdate();

            expect(globeTransform.getGlobeViewAllowed()).toBe(true);
            expect(globeTransform.useGlobeControls).toBe(true);
        });

        test('animates to false', async () => {
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.newFrameUpdate();
            globeTransform.setGlobeViewAllowed(false);

            await sleep(20);
            globeTransform.newFrameUpdate();
            expect(globeTransform.getGlobeViewAllowed()).toBe(false);
            expect(globeTransform.useGlobeControls).toBe(true);

            await sleep(1000);
            globeTransform.newFrameUpdate();
            expect(globeTransform.getGlobeViewAllowed()).toBe(false);
            expect(globeTransform.useGlobeControls).toBe(false);
        });

        test('can skip animation if requested', async () => {
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.newFrameUpdate();
            globeTransform.setGlobeViewAllowed(false, false);

            await sleep(20);
            globeTransform.newFrameUpdate();
            expect(globeTransform.getGlobeViewAllowed()).toBe(false);
            expect(globeTransform.useGlobeControls).toBe(false);
        });
    });

    describe('getBounds', () => {
        const precisionDigits = 10;

        const globeTransform = new GlobeTransform(globeProjectionMock);
        globeTransform.resize(640, 480);

        test('basic', () => {
            globeTransform.setCenter(new LngLat(0, 0));
            globeTransform.setZoom(1);
            const bounds = globeTransform.getBounds();
            expect(bounds._ne.lat).toBeCloseTo(83.96012370156063, precisionDigits);
            expect(bounds._ne.lng).toBeCloseTo(85.46274667048044, precisionDigits);
            expect(bounds._sw.lat).toBeCloseTo(-83.96012370156063, precisionDigits);
            expect(bounds._sw.lng).toBeCloseTo(-85.46274667048044, precisionDigits);
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
            expect(bounds._ne.lat).toBeCloseTo(-1.2776252401855572, precisionDigits);
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
});
import {GlobeProjection} from './globe';
import {EXTENT} from '../../data/extent';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {expectToBeCloseToArray} from './mercator_transform.test';
import {GlobeTransform, angularCoordinatesRadiansToVector, mercatorCoordinatesToAngularCoordinatesRadians, sphereSurfacePointToCoordinates} from './globe_transform';
import {OverscaledTileID} from '../../source/tile_id';

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
            globeTransform.zoom = 1;
            globeTransform.center = new LngLat(0, 80);
            globeTransform.newFrameUpdate();
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [0, 2.303287153877504, 1.0008639206711287], precisionDigits);

            globeTransform.pitch = 35;
            globeTransform.bearing = 70;
            globeTransform.newFrameUpdate();
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [-0.814593815424988, 1.9344461675893443, 1.1638588658177578], precisionDigits);

            globeTransform.center = new LngLat(-10, 42);
            globeTransform.newFrameUpdate();
            expectToBeCloseToArray(globeTransform.cameraPosition as Array<number>, [-1.1254754857999196, 1.2771958498461375, 1.6918298410217196], precisionDigits);
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

        test('project location to coordinates', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.newFrameUpdate();
            let projected: Point;

            globeTransform.center = new LngLat(0, 0);
            projected = globeTransform.locationPoint(globeTransform.center);
            expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
            expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);

            globeTransform.center = new LngLat(70, 50);
            projected = globeTransform.locationPoint(globeTransform.center);
            expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
            expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);

            globeTransform.center = new LngLat(0, 84);
            projected = globeTransform.locationPoint(globeTransform.center);
            expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
            expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);

            // Try projecting a location that is slightly above and below map's center point
            globeTransform.center = new LngLat(0, 0);
            projected = globeTransform.locationPoint(new LngLat(0, 1));
            expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
            expect(projected.y).toBeLessThan(screenCenter.y);

            projected = globeTransform.locationPoint(new LngLat(0, -1));
            expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
            expect(projected.y).toBeGreaterThan(screenCenter.y);
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
            globeTransform.zoom = 1;
            globeTransform.center = new LngLat(0, 80);
            globeTransform.newFrameUpdate();

            let coords: LngLat;
            let projected: Point;
            let unprojected: LngLat;

            coords = new LngLat(179.9, 71);
            projected = globeTransform.locationPoint(coords);
            unprojected = globeTransform.pointLocation(projected);
            expect(projected.x).toBeCloseTo(256.1979714385892, precisionDigits);
            expect(projected.y).toBeCloseTo(20.681103119412427, precisionDigits);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);

            // Near the pole
            coords = new LngLat(179.9, 89.0);
            projected = globeTransform.locationPoint(coords);
            unprojected = globeTransform.pointLocation(projected);
            expect(projected.x).toBeCloseTo(256.01175650888337, precisionDigits);
            expect(projected.y).toBeCloseTo(96.02496826108228, precisionDigits);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
        });

        test('unproject outside of sphere', () => {
            const precisionDigits = 10;
            const globeTransform = createGlobeTransform(globeProjectionMock);
            // Try unprojection a point somewhere above the western horizon
            globeTransform.pitch = 60;
            globeTransform.bearing = -90;
            globeTransform.newFrameUpdate();
            const unprojected = globeTransform.pointLocation(screenTopEdgeCenter);
            expect(unprojected.lng).toBeGreaterThan(250.0);
            expect(unprojected.lat).toBeCloseTo(0.0, precisionDigits);
        });

        test('setLocationAtPoint', () => {
            const precisionDigits = 2; // JP: TODO: increase precision
            const globeTransform = createGlobeTransform(globeProjectionMock);
            globeTransform.zoom = 1;
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
    });
});

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
    globeTransform.fov = 45;
    return globeTransform;
}

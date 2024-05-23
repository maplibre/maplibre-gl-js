import {mat4} from 'gl-matrix';
import {GlobeProjection} from './globe';
import {EXTENT} from '../../data/extent';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {expectToBeCloseToArray} from '../mercator_transform.test';
import {GlobeTransform} from './globe_transform';
import {OverscaledTileID} from '../../source/tile_id';

describe('GlobeTransform', () => {
    describe('getProjectionData', () => {
        const globeTransform = new GlobeTransform();

        test('fallback matrix is set', () => {
            const mat = mat4.create();
            mat[0] = 1234;
            const projectionData = globeTransform.getProjectionData(new OverscaledTileID(0, 0, 0, 0, 0), mat);
            expect(projectionData.u_projection_fallback_matrix).toEqual(mat);
        });
        test('mercator tile extents are set', () => {
            const projectionData = globeTransform.getProjectionData(new OverscaledTileID(1, 0, 1, 1, 0));
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });
    });

    describe('clipping plane', () => {
        const globeTransform = new GlobeTransform();

        describe('general plane properties', () => {
            globeTransform.updateProjection();
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
            const globe = new GlobeProjection();

            let projectedAngles;
            let projected;

            projectedAngles = globe['_mercatorCoordinatesToAngularCoordinates'](0.5, 0.5);
            expectToBeCloseToArray(projectedAngles, [0, 0], precisionDigits);
            projected = globe['_angularCoordinatesToVector'](projectedAngles[0], projectedAngles[1]) as [number, number, number];
            expectToBeCloseToArray(projected, [0, 0, 1], precisionDigits);

            projectedAngles = globe['_mercatorCoordinatesToAngularCoordinates'](0, 0.5);
            expectToBeCloseToArray(projectedAngles, [Math.PI, 0], precisionDigits);
            projected = globe['_angularCoordinatesToVector'](projectedAngles[0], projectedAngles[1]) as [number, number, number];
            expectToBeCloseToArray(projected, [0, 0, -1], precisionDigits);

            projectedAngles = globe['_mercatorCoordinatesToAngularCoordinates'](0.75, 0.5);
            expectToBeCloseToArray(projectedAngles, [Math.PI / 2.0, 0], precisionDigits);
            projected = globe['_angularCoordinatesToVector'](projectedAngles[0], projectedAngles[1]) as [number, number, number];
            expectToBeCloseToArray(projected, [1, 0, 0], precisionDigits);

            projectedAngles = globe['_mercatorCoordinatesToAngularCoordinates'](0.5, 0);
            expectToBeCloseToArray(projectedAngles, [0, 1.4844222297453324], precisionDigits); // ~0.47pi
            projected = globe['_angularCoordinatesToVector'](projectedAngles[0], projectedAngles[1]) as [number, number, number];
            expectToBeCloseToArray(projected, [0, 0.99627207622075, 0.08626673833405434], precisionDigits);
        });

        test('sphere point to coordinate', () => {
            const precisionDigits = 10;
            const globe = new GlobeProjection();
            let unprojected = globe['_sphereSurfacePointToCoordinates']([0, 0, 1]) as LngLat;
            expect(unprojected.lng).toBeCloseTo(0, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(0, precisionDigits);
            unprojected = globe['_sphereSurfacePointToCoordinates']([0, 1, 0]) as LngLat;
            expect(unprojected.lng).toBeCloseTo(0, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(90, precisionDigits);
            unprojected = globe['_sphereSurfacePointToCoordinates']([1, 0, 0]) as LngLat;
            expect(unprojected.lng).toBeCloseTo(90, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(0, precisionDigits);
        });

        const screenCenter = new Point(640 / 2 - 0.5, 480 / 2 - 0.5); // We need the exact screen center
        const screenTopEdgeCenter = new Point(640 / 2 - 0.5, 0.5);

        test('unproject screen center', () => {
            const precisionDigits = 2;
            const globeTransform = new GlobeTransform();
            globeTransform.updateProjection();
            let unprojected = globeTransform.unprojectScreenPoint(screenCenter);
            expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);

            globeTransform.center.lng = 90.0;
            globeTransform.updateProjection();
            unprojected = globeTransform.unprojectScreenPoint(screenCenter);
            expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);

            globeTransform.center.lng = 0.0;
            globeTransform.center.lat = 60.0;
            globeTransform.updateProjection();
            unprojected = globeTransform.unprojectScreenPoint(screenCenter);
            expect(unprojected.lng).toBeCloseTo(globeTransform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(globeTransform.center.lat, precisionDigits);
        });

        test('unproject outside of sphere', () => {
            const precisionDigits = 2;
            const globeTransform = new GlobeTransform();
            // Try unprojection a point somewhere above the western horizon
            globeTransform.pitch = 60;
            globeTransform.bearing = -90;
            globeTransform.updateProjection();
            const unprojected = globeTransform.unprojectScreenPoint(screenTopEdgeCenter);
            expect(unprojected.lng).toBeLessThan(-38.0);
            expect(unprojected.lat).toBeCloseTo(0.0, precisionDigits);
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

import {mat4} from 'gl-matrix';
import {GlobeProjection} from './globe';
import {EXTENT} from '../../data/extent';
import {expectToBeCloseToArray} from './mercator.test';
import type {TransformLike} from './projection';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {MercatorTransform} from './mercator_transform';

describe('GlobeProjection', () => {
    describe('getProjectionData', () => {
        const globe = new GlobeProjection();

        test('fallback matrix is set', () => {
            const mat = mat4.create();
            mat[0] = 1234;
            const projectionData = globe.getProjectionData({
                x: 0,
                y: 0,
                z: 0
            }, mat);
            expect(projectionData.u_projection_fallback_matrix).toEqual(mat);
        });
        test('mercator tile extents are set', () => {
            const mat = mat4.create();
            const projectionData = globe.getProjectionData({
                x: 1,
                y: 0,
                z: 1
            }, mat);
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });
    });

    describe('clipping plane', () => {
        const globe = new GlobeProjection();

        describe('general plane properties', () => {
            const mat = mat4.create();
            const transform = createMockTransform({
                pitch: 0,
            });
            globe.updateProjection(transform);
            const projectionData = globe.getProjectionData({
                x: 0,
                y: 0,
                z: 0
            }, mat);

            test('plane vector length', () => {
                const len = Math.sqrt(
                    projectionData.u_projection_clipping_plane[0] * projectionData.u_projection_clipping_plane[0] +
                    projectionData.u_projection_clipping_plane[1] * projectionData.u_projection_clipping_plane[1] +
                    projectionData.u_projection_clipping_plane[2] * projectionData.u_projection_clipping_plane[2]
                );
                expect(len).toBeCloseTo(0.25);
            });

            test('camera is in positive halfspace', () => {
                expect(planeDistance(globe.cameraPosition as [number, number, number], projectionData.u_projection_clipping_plane)).toBeGreaterThan(0);
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
            const globe = new GlobeProjection();
            const transform = createMockTransform({}) as any as MercatorTransform; // JP: TODO: remove this hack
            globe.updateProjection(transform);
            let unprojected = globe.unprojectScreenPoint(screenCenter, transform);
            expect(unprojected.lng).toBeCloseTo(transform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(transform.center.lat, precisionDigits);

            transform.center.lng = 90.0;
            globe.updateProjection(transform);
            unprojected = globe.unprojectScreenPoint(screenCenter, transform);
            expect(unprojected.lng).toBeCloseTo(transform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(transform.center.lat, precisionDigits);

            transform.center.lng = 0.0;
            transform.center.lat = 60.0;
            globe.updateProjection(transform);
            unprojected = globe.unprojectScreenPoint(screenCenter, transform);
            expect(unprojected.lng).toBeCloseTo(transform.center.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(transform.center.lat, precisionDigits);
        });

        test('unproject outside of sphere', () => {
            const precisionDigits = 2;
            const globe = new GlobeProjection();
            // Try unprojection a point somewhere above the western horizon
            const transform = createMockTransform({
                pitch: 60,
                bearing: -90,
            }) as any as MercatorTransform; // JP: TODO: remove this hack
            globe.updateProjection(transform);
            const unprojected = globe.unprojectScreenPoint(screenTopEdgeCenter, transform);
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

function createMockTransform(object: {
    center?: {
        latDegrees: number;
        lngDegrees: number;
    };
    pitch?: number;
    angleDegrees?: number;
    width?: number;
    height?: number;
    bearing?: number;
}): TransformLike {
    return {
        center: new LngLat(
            object.center ? (object.center.lngDegrees / 180.0 * Math.PI) : 0,
            object.center ? (object.center.latDegrees / 180.0 * Math.PI) : 0),
        worldSize: 10.5 * 512,
        fov: 45.0,
        width: (object && object.width) ? object.width : 640,
        height: (object && object.height) ? object.height : 480,
        cameraToCenterDistance: 759,
        pitch: (object && object.pitch) ? object.pitch : 0, // in degrees
        angle: (object && object.bearing) ? (-object.bearing / 180.0 * Math.PI) : 0,
        zoom: 0,
        invProjMatrix: null,
    };
}

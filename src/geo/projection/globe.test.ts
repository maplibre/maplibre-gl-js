import {mat4} from 'gl-matrix';
import {GlobeProjection} from './globe';
import {EXTENT} from '../../data/extent';
import {Transform} from '../transform';
import {expectToBeCloseToArray} from './mercator.test';

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
                pitchDegrees: 0,
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
    pitchDegrees?: number;
    angleDegrees?: number;
}): Transform {
    const pitchDegrees = object.pitchDegrees ? object.pitchDegrees : 0;
    return {
        center: {
            lat: object.center ? (object.center.latDegrees / 180.0 * Math.PI) : 0,
            lng: object.center ? (object.center.lngDegrees / 180.0 * Math.PI) : 0,
        },
        worldSize: 10.5 * 512,
        _fov: Math.PI / 4.0,
        width: 640,
        height: 480,
        cameraToCenterDistance: 759,
        _pitch: pitchDegrees / 180.0 * Math.PI, // in radians
        pitch: pitchDegrees, // in degrees
        angle: object.angleDegrees ? (object.angleDegrees / 180.0 * Math.PI) : 0,
        zoom: 0,
    } as Transform;
}

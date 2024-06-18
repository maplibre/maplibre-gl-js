import {mat4} from 'gl-matrix';
import {ProjectionData} from '../../render/program/projection_program';
import {EXTENT} from '../../data/extent';
import {MercatorProjection} from './mercator';

describe('MercatorProjection', () => {
    describe('getProjectionData', () => {
        const mercator = new MercatorProjection();

        test('fallback matrix is set', () => {
            const mat = mat4.create();
            mat[0] = 1234;
            const projectionData = mercator.getProjectionData({
                x: 0,
                y: 0,
                z: 0
            }, mat);
            expect(projectionData.u_projection_fallback_matrix).toEqual(mat);
        });
        test('mercator tile extents are set', () => {
            const mat = mat4.create();
            let projectionData: ProjectionData;

            projectionData = mercator.getProjectionData({
                x: 0,
                y: 0,
                z: 0
            }, mat);
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0, 0, 1 / EXTENT, 1 / EXTENT]);

            projectionData = mercator.getProjectionData({
                x: 0,
                y: 0,
                z: 1
            }, mat);
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0, 0, 0.5 / EXTENT, 0.5 / EXTENT]);

            projectionData = mercator.getProjectionData({
                x: 1,
                y: 0,
                z: 1
            }, mat);
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });
        test('mercator tile extents are set for negative zoom', () => {
            const mat = mat4.create();
            const projectionData = mercator.getProjectionData({
                x: 0,
                y: 0,
                z: -2
            }, mat);
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0, 0, 1 / EXTENT, 1 / EXTENT]); // same as for zoom=0, as it gets clamped
        });
    });
});

export function expectToBeCloseToArray(actual: Array<number>, expected: Array<number>, precision?: number) {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], precision);
    }
}

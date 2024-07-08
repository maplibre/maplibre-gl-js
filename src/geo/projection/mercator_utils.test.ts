import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {getBasicProjectionData, getMercatorHorizon, locationCoordinate, projectToWorldCoordinates} from './mercator_utils';
import {MercatorTransform} from './mercator_transform';
import {MAX_VALID_LATITUDE} from '../transform_helper';
import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../../source/tile_id';
import {ProjectionData} from '../../render/program/projection_program';
import {EXTENT} from '../../data/extent';
import {expectToBeCloseToArray} from '../../util/test/util';

describe('mercator utils', () => {
    test('projectToWorldCoordinates basic', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        expect(projectToWorldCoordinates(transform.worldSize, transform.center)).toEqual(new Point(262144, 262144));
    });

    test('projectToWorldCoordinates clamps latitude', () => {
        const transform = new MercatorTransform(0, 22, 0, 60, true);

        expect(projectToWorldCoordinates(transform.worldSize, new LngLat(0, -90))).toEqual(projectToWorldCoordinates(transform.worldSize, new LngLat(0, -MAX_VALID_LATITUDE)));
        expect(projectToWorldCoordinates(transform.worldSize, new LngLat(0, 90))).toEqual(projectToWorldCoordinates(transform.worldSize, new LngLat(0, MAX_VALID_LATITUDE)));
    });

    test('locationCoordinate', () => {
        expect(locationCoordinate(new LngLat(0, 0))).toEqual({x: 0.5, y: 0.5, z: 0});
    });

    test('getMercatorHorizon', () => {
        const transform = new MercatorTransform(0, 22, 0, 85, true);
        transform.resize(500, 500);
        transform.setPitch(75);
        const horizon = getMercatorHorizon(transform);

        expect(horizon).toBeCloseTo(170.8176101748407, 10);
    });

    describe('getBasicProjectionData', () => {
        test('posMatrix is set', () => {
            const mat = mat4.create();
            mat[0] = 1234;
            const projectionData = getBasicProjectionData(new OverscaledTileID(0, 0, 0, 0, 0), mat);
            expect(projectionData.u_projection_fallback_matrix).toEqual(mat);
        });

        test('mercator tile extents are set', () => {
            let projectionData: ProjectionData;

            projectionData = getBasicProjectionData(new OverscaledTileID(0, 0, 0, 0, 0));
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0, 0, 1 / EXTENT, 1 / EXTENT]);

            projectionData = getBasicProjectionData(new OverscaledTileID(1, 0, 1, 0, 0));
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0, 0, 0.5 / EXTENT, 0.5 / EXTENT]);

            projectionData = getBasicProjectionData(new OverscaledTileID(1, 0, 1, 1, 0));
            expectToBeCloseToArray(projectionData.u_projection_tile_mercator_coords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
        });
    });
});

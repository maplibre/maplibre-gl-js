import {describe, expect, test} from 'vitest';
import {expectToBeCloseToArray} from '../../util/test/util';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider';
import {ConvexVolume} from '../../util/primitives/convex_volume';

describe('bounding volume creation', () => {
    test('z=0', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const convex = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 0,
        }, null, null, null);
        expect(convex).toEqual(ConvexVolume.fromAabb(
            [-1, -1, -1],
            [1, 1, 1],
        ));
    });

    test('z=1,x=0', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const convex = detailsProvider.getTileBoundingVolume({
            x: 0,
            y: 0,
            z: 1,
        }, null, null, null);
        expect(convex).toEqual(ConvexVolume.fromAabb(
            [-1, 0, -1],
            [0, 1, 1],
        ));
    });

    test('z=1,x=1', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const convex = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 0,
            z: 1,
        }, null, null, null);
        expect(convex).toEqual(ConvexVolume.fromAabb(
            [0, 0, -1],
            [1, 1, 1],
        ));
    });

    test('z=5,x=1,y=1', () => {
        const detailsProvider = new GlobeCoveringTilesDetailsProvider();
        const convex = detailsProvider.getTileBoundingVolume({
            x: 1,
            y: 1,
            z: 5,
        }, null, null, null);
        const precision = 10;
        const expectedMin = [-0.04878262717137475, 0.9918417649235776, -0.1250257487589308];
        const expectedMax = [-0.020462724105427713, 0.9944839919477184, -0.09690430455523656];
        const expectedPoints = [
            [-0.040144275638466294, 0.9946001124628003, -0.09691685469802916],
            [-0.04013795776704037, 0.9944589865528525, -0.09690160200714736],
            [-0.02046537424682884, 0.9946001124628002, -0.10288638417221826],
            [-0.020462153423906553, 0.9944589865528524, -0.10287019200194392],
            [-0.04902182691658952, 0.9919123845540323, -0.11834915939433684],
            [-0.049015509045163594, 0.9917712586440846, -0.11833390670345505],
            [-0.02499111064168652, 0.9919123845540323, -0.1256387974810376],
            [-0.02498788981876423, 0.9917712586440844, -0.12562260531076325]
        ];
        const expectedPlanes = [
            [0.033568258567807485, -0.9932912960221243, 0.11065971834147033, 1],
            [
                -0.033568258567807485,
                0.9932912960221243,
                -0.11065971834147033,
                -0.999857920923587
            ],
            [
                -0.2883372432854479,
                -0.11563909912606864,
                -0.9505205062952928,
                0.011318113428480242
            ],
            [
                0.2883372432854479,
                0.11563909912606864,
                0.9505205062952928,
                0.011924266779254289
            ],
            [
                0.9238795325112867,
                -3.8143839245115144e-17,
                -0.38268343236509017,
                0
            ],
            [-0.9807852804032307, 0, 0.19509032201612764, 0]
        ];
        expectToBeCloseToArray([...convex.min], expectedMin, precision);
        expectToBeCloseToArray([...convex.max], expectedMax, precision);
        expect(convex.points).toHaveLength(expectedPoints.length);
        for (let i = 0; i < convex.points.length; i++) {
            expectToBeCloseToArray([...convex.points[i]], expectedPoints[i], precision);
        }
        expect(convex.planes).toHaveLength(expectedPlanes.length);
        for (let i = 0; i < convex.planes.length; i++) {
            expectToBeCloseToArray([...convex.planes[i]], expectedPlanes[i], precision);
        }
    });
});

import {vi, describe, test, expect} from 'vitest';
import {CollisionIndex} from './collision_index';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {CanonicalTileID, UnwrappedTileID} from '../source/tile_id';
import {mat4} from 'gl-matrix';

describe('CollisionIndex', () => {
    test('floating point precision', () => {
        const x = 100000.123456, y = 0;
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(200, 200);
        const tile = new UnwrappedTileID(0, new CanonicalTileID(0, 0, 0));
        vi.spyOn(transform, 'calculatePosMatrix').mockImplementation(() => mat4.create());

        const ci = new CollisionIndex(transform);
        expect(ci.projectAndGetPerspectiveRatio(x, y, tile, null).x).toBeCloseTo(10000212.3456, 10);
    });
});

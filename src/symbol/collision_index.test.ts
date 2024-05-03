import {CollisionIndex} from './collision_index';
import {mat4} from 'gl-matrix';

import {Transform} from '../geo/transform';
import {createProjection} from '../geo/projection/projection';

describe('CollisionIndex', () => {

    test('floating point precision', () => {
        const posMatrix = mat4.create();
        const x = 100000.123456, y = 0;
        const transform = new Transform(0, 22, 0, 60, true);
        transform.resize(200, 200);

        const ci = new CollisionIndex(transform, createProjection());
        expect(ci.projectAndGetPerspectiveRatio(posMatrix, x, y, null).point.x).toBeCloseTo(10000212.3456, 10);
    });

});

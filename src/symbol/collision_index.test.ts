import {CollisionIndex} from './collision_index';
import {MercatorProjection} from '../geo/projection/mercator';
import {MercatorTransform} from '../geo/projection/mercator_transform';

describe('CollisionIndex', () => {

    test('floating point precision', () => {
        const x = 100000.123456, y = 0;
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(200, 200);

        const ci = new CollisionIndex(transform, new MercatorProjection());
        expect(ci.projectAndGetPerspectiveRatio(x, y, null).point.x).toBeCloseTo(10000212.3456, 10);
    });

});

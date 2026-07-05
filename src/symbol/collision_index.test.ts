import {vi, describe, test, expect} from 'vitest';
import {CollisionIndex} from './collision_index.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {CanonicalTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import {createIdentityMat4f64} from '../util/util.ts';

describe('CollisionIndex', () => {
    test('floating point precision', () => {
        const x = 100000.123456, y = 0;
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(200, 200);
        const tile = new UnwrappedTileID(0, new CanonicalTileID(0, 0, 0));
        vi.spyOn(transform, 'calculatePosMatrix').mockImplementation(() => createIdentityMat4f64());

        const ci = new CollisionIndex(transform);
        expect(ci.projectAndGetPerspectiveRatio(x, y, tile, null).x).toBeCloseTo(10000212.3456, 10);
    });
});

import {describe, test, expect} from 'vitest';
import {CollisionIndex} from './collision_index.ts';
import {CanonicalTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import {createIdentityMat4f32, createIdentityMat4f64} from '../util/util.ts';
import {getMatrixCache} from '../geo/projection/mercator_camera_math.ts';
import {createTestCamera} from '../util/test/util.ts';

import type {MercatorProjectedCamera} from '../geo/projected_camera.ts';

describe('CollisionIndex', () => {
    test('floating point precision', () => {
        const x = 100000.123456, y = 0;
        const projectedCamera = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true, width: 200, height: 200}).camera as MercatorProjectedCamera;
        const tile = new UnwrappedTileID(0, new CanonicalTileID(0, 0, 0));
        getMatrixCache(projectedCamera).posMatrices.set(tile.key, {f64: createIdentityMat4f64(), f32: createIdentityMat4f32()});

        const ci = new CollisionIndex(projectedCamera);
        expect(ci.projectAndGetPerspectiveRatio(x, y, tile, null).x).toBeCloseTo(10000212.3456, 10);
    });
});

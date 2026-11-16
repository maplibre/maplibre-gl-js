import {vi, describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {CollisionIndex} from './collision_index.ts';
import {CanonicalTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import {getCameraMath} from '../camera/camera_math_factory.ts';
import {createTestCamera} from '../util/test/util.ts';

describe('CollisionIndex', () => {
    test('floating point precision', ({onTestFinished}) => {
        const x = 100000.123456, y = 0;
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true, width: 200, height: 200});
        const tile = new UnwrappedTileID(0, new CanonicalTileID(0, 0, 0));
        const projectTileCoordinates = vi.spyOn(getCameraMath(projectedCamera), 'projectTileCoordinates').mockReturnValue({point: new Point(x, y), signedDistanceFromCamera: 1, isOccluded: false});
        onTestFinished(() => projectTileCoordinates.mockRestore());

        const ci = new CollisionIndex(projectedCamera);
        expect(ci.projectAndGetPerspectiveRatio(x, y, tile, null).x).toBeCloseTo(10000212.3456, 10);
    });
});

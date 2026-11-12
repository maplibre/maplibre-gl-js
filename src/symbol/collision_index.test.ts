import {vi, describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {CollisionIndex} from './collision_index.ts';
import {createMercatorTransform} from '../geo/projection/mercator_transform.ts';
import {CanonicalTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import {getCameraMath} from '../camera/camera_math_factory.ts';

describe('CollisionIndex', () => {
    test('floating point precision', ({onTestFinished}) => {
        const x = 100000.123456, y = 0;
        const transform = createMercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        transform.resize(200, 200);
        const tile = new UnwrappedTileID(0, new CanonicalTileID(0, 0, 0));
        const projectTileCoordinates = vi.spyOn(getCameraMath(transform.projectedCamera), 'projectTileCoordinates').mockReturnValue({point: new Point(x, y), signedDistanceFromCamera: 1, isOccluded: false});
        onTestFinished(() => projectTileCoordinates.mockRestore());

        const ci = new CollisionIndex(transform.projectedCamera);
        expect(ci.projectAndGetPerspectiveRatio(x, y, tile, null).x).toBeCloseTo(10000212.3456, 10);
    });
});

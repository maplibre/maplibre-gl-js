import {describe, expect, test} from 'vitest';
import {hillshadeUniformPrepareValues} from './hillshade_program.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {DEMData} from '../../data/dem_data.ts';
import {RGBAImage} from '../../util/image.ts';
import {createMercatorCameraProjection} from '../../geo/projection/camera_projection.ts';
import {createIdentityCrsCamera} from '../../util/test/util.ts';

describe('hillshadeUniformPrepareValues', () => {
    test('keeps the world width the shader always used on a mercator map', () => {
        const {worldCoordinateHelper} = createMercatorCameraProjection();
        const dem = new DEMData('0', new RGBAImage({width: 8, height: 8}), 'mapbox');
        const uniformValues = hillshadeUniformPrepareValues(worldCoordinateHelper, new OverscaledTileID(0, 0, 0, 0, 0), dem);
        expect(uniformValues['u_log2_world_width']).toBe(25.2562);
    });

    test('takes the world width from the zoom 0 extent of a registered CRS', () => {
        const {context} = createIdentityCrsCamera(256, 256);
        const dem = new DEMData('0', new RGBAImage({width: 8, height: 8}), 'mapbox');
        const uniformValues = hillshadeUniformPrepareValues(context.projection.worldCoordinateHelper, new OverscaledTileID(0, 0, 0, 0, 0), dem);
        expect(uniformValues['u_log2_world_width']).toBeCloseTo(7.491853, 6);
    });
});

import {describe, expect, test} from 'vitest';
import {hillshadeUniformPrepareValues} from './hillshade_program.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {DEMData} from '../../data/dem_data.ts';
import {RGBAImage} from '../../util/image.ts';
import {createMercatorTransform} from '../../geo/projection/mercator_transform.ts';
import {createIdentityCrsTransform} from '../../util/test/util.ts';

describe('hillshadeUniformPrepareValues', () => {
    test('keeps the world width the shader always used on a mercator map', () => {
        const transform = createMercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        const dem = new DEMData('0', new RGBAImage({width: 8, height: 8}), 'mapbox');
        const uniformValues = hillshadeUniformPrepareValues(transform, new OverscaledTileID(0, 0, 0, 0, 0), dem);
        expect(uniformValues['u_log2_world_width']).toBe(25.2562);
    });

    test('takes the world width from the zoom 0 extent of a registered CRS', () => {
        const transform = createIdentityCrsTransform(256, 256);
        const dem = new DEMData('0', new RGBAImage({width: 8, height: 8}), 'mapbox');
        const uniformValues = hillshadeUniformPrepareValues(transform, new OverscaledTileID(0, 0, 0, 0, 0), dem);
        expect(uniformValues['u_log2_world_width']).toBeCloseTo(7.491853, 6);
    });
});

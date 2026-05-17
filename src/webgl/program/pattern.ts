import {
    type Uniform1i,
    type Uniform1f,
    type Uniform2f,
    type Uniform3f
} from '../uniform_binding.ts';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units.ts';

import type {Painter} from '../../render/painter.ts';
import type {CrossfadeParameters} from '../../style/evaluation_parameters.ts';
import type {UniformValues} from '../uniform_binding.ts';
import type {Tile} from '../../tile/tile.ts';

export type PatternUniformsType = {
    // pattern uniforms:
    'u_image': Uniform1i;
    'u_texsize': Uniform2f;
    'u_scale': Uniform3f;
    'u_fade': Uniform1f;
    'u_pixel_coord_upper': Uniform2f;
    'u_pixel_coord_lower': Uniform2f;
};

function patternUniformValues(crossfade: CrossfadeParameters, painter: Painter, tile: Tile): UniformValues<PatternUniformsType> {

    const tileRatio = 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom);

    const numTiles = Math.pow(2, tile.tileID.overscaledZ);
    const tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom) / numTiles;

    const pixelX = tileSizeAtNearestZoom * (tile.tileID.canonical.x + tile.tileID.wrap * numTiles);
    const pixelY = tileSizeAtNearestZoom * tile.tileID.canonical.y;

    return {
        'u_image': 0,
        'u_texsize': tile.imageAtlasTexture.size,
        'u_scale': [tileRatio, crossfade.fromScale, crossfade.toScale],
        'u_fade': crossfade.t,
        // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
        'u_pixel_coord_upper': [pixelX >> 16, pixelY >> 16],
        'u_pixel_coord_lower': [pixelX & 0xFFFF, pixelY & 0xFFFF]
    };
}

export {patternUniformValues};

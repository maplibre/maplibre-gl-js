import {mat4} from 'gl-matrix';

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformColor,
    UniformFloatArray,
    UniformColorArray,
    UniformMatrix4f,
    Uniform4f
} from '../uniform_binding';
import {EXTENT} from '../../data/extent';
import {MercatorCoordinate} from '../../geo/mercator_coordinate';

import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {Tile} from '../../source/tile';
import type {Painter} from '../painter';
import type {HillshadeStyleLayer} from '../../style/style_layer/hillshade_style_layer';
import type {DEMData} from '../../data/dem_data';
import type {OverscaledTileID} from '../../source/tile_id';

export type HillshadeUniformsType = {
    'u_image': Uniform1i;
    'u_latrange': Uniform2f;
    'u_exaggeration': Uniform1f;
    'u_altitudes': UniformFloatArray;
    'u_azimuths': UniformFloatArray;
    'u_accent': UniformColor;
    'u_method': Uniform1i;
    'u_shadows': UniformColorArray;
    'u_highlights': UniformColorArray;
};

export type HillshadePrepareUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_image': Uniform1i;
    'u_dimension': Uniform2f;
    'u_zoom': Uniform1f;
    'u_unpack': Uniform4f;
};

const hillshadeUniforms = (context: Context, locations: UniformLocations): HillshadeUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_latrange': new Uniform2f(context, locations.u_latrange),
    'u_exaggeration': new Uniform1f(context, locations.u_exaggeration),
    'u_altitudes': new UniformFloatArray(context, locations.u_altitudes),
    'u_azimuths': new UniformFloatArray(context, locations.u_azimuths),
    'u_accent': new UniformColor(context, locations.u_accent),
    'u_method': new Uniform1i(context, locations.u_method),
    'u_shadows': new UniformColorArray(context, locations.u_shadows),
    'u_highlights': new UniformColorArray(context, locations.u_highlights)
});

const hillshadePrepareUniforms = (context: Context, locations: UniformLocations): HillshadePrepareUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_dimension': new Uniform2f(context, locations.u_dimension),
    'u_zoom': new Uniform1f(context, locations.u_zoom),
    'u_unpack': new Uniform4f(context, locations.u_unpack)
});

const hillshadeUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: HillshadeStyleLayer,
): UniformValues<HillshadeUniformsType> => {
    const accent = layer.paint.get('hillshade-accent-color');
    let method;
    switch (layer.paint.get('hillshade-method')) {
        case 'basic':
            method = 4;
            break;
        case 'combined':
            method = 1;
            break;
        case 'igor':
            method = 2;
            break;
        case 'multidirectional':
            method = 3;
            break;
        case 'standard':
        default:
            method = 0;
            break;
    }

    const illumination = layer.getIlluminationProperties();

    for (let i = 0; i < illumination.directionRadians.length; i++) {
        // modify azimuthal angle by map rotation if light is anchored at the viewport
        if (layer.paint.get('hillshade-illumination-anchor') === 'viewport') {
            illumination.directionRadians[i] += painter.transform.bearingInRadians;
        }
    }
    return {
        'u_image': 0,
        'u_latrange': getTileLatRange(painter, tile.tileID),
        'u_exaggeration': layer.paint.get('hillshade-exaggeration'),
        'u_altitudes': illumination.altitudeRadians,
        'u_azimuths': illumination.directionRadians,
        'u_accent': accent,
        'u_method': method,
        'u_highlights': illumination.highlightColor,
        'u_shadows': illumination.shadowColor
    };
};

const hillshadeUniformPrepareValues = (tileID: OverscaledTileID, dem: DEMData): UniformValues<HillshadePrepareUniformsType> => {

    const stride = dem.stride;
    const matrix = mat4.create();
    // Flip rendering at y axis.
    mat4.ortho(matrix, 0, EXTENT, -EXTENT, 0, 0, 1);
    mat4.translate(matrix, matrix, [0, -EXTENT, 0]);

    return {
        'u_matrix': matrix,
        'u_image': 1,
        'u_dimension': [stride, stride],
        'u_zoom': tileID.overscaledZ,
        'u_unpack': dem.getUnpackVector()
    };
};

function getTileLatRange(painter: Painter, tileID: OverscaledTileID) {
    // for scaling the magnitude of a points slope by its latitude
    const tilesAtZoom = Math.pow(2, tileID.canonical.z);
    const y = tileID.canonical.y;
    return [
        new MercatorCoordinate(0, y / tilesAtZoom).toLngLat().lat,
        new MercatorCoordinate(0, (y + 1) / tilesAtZoom).toLngLat().lat];
}

export {
    hillshadeUniforms,
    hillshadePrepareUniforms,
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
};

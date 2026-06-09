import {mat4} from 'gl-matrix';

import {Uniform1i, Uniform1f, Uniform2f, UniformMatrix4f} from '../uniform_binding.ts';

import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {Painter} from '../../render/painter.ts';

export type LayerOpacityUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_world': Uniform2f;
    'u_image': Uniform1i;
    'u_opacity': Uniform1f;
};

const layerOpacityUniforms = (context: Context, locations: UniformLocations): LayerOpacityUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_world': new Uniform2f(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

const layerOpacityUniformValues = (
    painter: Painter,
    opacity: number,
    textureUnit: number
): UniformValues<LayerOpacityUniformsType> => {
    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);

    const gl = painter.context.gl;

    return {
        'u_matrix': matrix,
        'u_world': [gl.drawingBufferWidth, gl.drawingBufferHeight],
        'u_image': textureUnit,
        'u_opacity': opacity
    };
};

export {
    layerOpacityUniforms,
    layerOpacityUniformValues
};

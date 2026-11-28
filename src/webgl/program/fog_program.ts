import {Uniform1f, UniformColor, UniformMatrix4f} from '../uniform_binding.ts';

import type {SkyPropsPossiblyEvaluated} from '../../style/sky_properties.g.ts';
import type {mat4} from 'gl-matrix';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {Context} from '../context.ts';

export type FogUniformsType = {
    'u_ele_delta': Uniform1f;
    'u_fog_matrix': UniformMatrix4f;
    'u_fog_color': UniformColor;
    'u_fog_ground_blend': Uniform1f;
    'u_fog_ground_blend_opacity': Uniform1f;
    'u_horizon_color': UniformColor;
    'u_horizon_fog_blend': Uniform1f;
};

const fogUniforms = (context: Context, locations: UniformLocations): FogUniformsType => ({
    'u_ele_delta': new Uniform1f(context, locations.u_ele_delta),
    'u_fog_matrix': new UniformMatrix4f(context, locations.u_fog_matrix),
    'u_fog_color': new UniformColor(context, locations.u_fog_color),
    'u_fog_ground_blend': new Uniform1f(context, locations.u_fog_ground_blend),
    'u_fog_ground_blend_opacity': new Uniform1f(context, locations.u_fog_ground_blend_opacity),
    'u_horizon_color': new UniformColor(context, locations.u_horizon_color),
    'u_horizon_fog_blend': new Uniform1f(context, locations.u_horizon_fog_blend)
});

/**
 * Uniform values for the fog pass over terrain tiles.
 * @param eleDelta - terrain skirt drop in meters
 * @param fogMatrix - projects tile coordinates to the fog's depth
 * @param sky - evaluated sky properties for the frame
 * @param opacity - pitch-faded fog opacity, see {@link calculateFogBlendOpacity}
 */
const fogUniformValues = (
    eleDelta: number,
    fogMatrix: mat4,
    sky: Readonly<SkyPropsPossiblyEvaluated>,
    opacity: number
): UniformValues<FogUniformsType> => ({
    'u_ele_delta': eleDelta,
    'u_fog_matrix': fogMatrix,
    'u_fog_color': sky['fog-color'],
    'u_fog_ground_blend': sky['fog-ground-blend'],
    'u_fog_ground_blend_opacity': opacity,
    'u_horizon_color': sky['horizon-color'],
    'u_horizon_fog_blend': sky['horizon-fog-blend']
});

export {fogUniforms, fogUniformValues};

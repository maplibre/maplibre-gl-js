import {UniformColor, Uniform1f} from '../uniform_binding';
import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import Transform from '../../geo/transform';
import Sky from '../../style/sky';

export type SkyUniformsType = {
    'u_sky_color': UniformColor;
    'u_fog_color': UniformColor;
    'u_horizon': Uniform1f;
    'u_horizon_blend': Uniform1f;
};

const skyUniforms = (context: Context, locations: UniformLocations): SkyUniformsType => ({
    'u_sky_color': new UniformColor(context, locations.u_sky_color),
    'u_fog_color': new UniformColor(context, locations.u_fog_color),
    'u_horizon': new Uniform1f(context, locations.u_horizon),
    'u_horizon_blend': new Uniform1f(context, locations.u_horizon_blend)
});

const skyUniformValues = (sky: Sky, transform: Transform, pixelRatio: number): UniformValues<SkyUniformsType> => ({
    'u_sky_color': sky.properties.get('sky-color'),
    'u_fog_color': sky.properties.get('fog-color'),
    'u_horizon': (transform.height / 2 + transform.getHorizon()) * pixelRatio,
    'u_horizon_blend': (sky.properties.get('horizon-blend') * transform.height / 2) * pixelRatio
});

export {skyUniforms, skyUniformValues};
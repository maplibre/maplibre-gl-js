import {UniformColor, Uniform1f, Uniform2f} from '../uniform_binding';
import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import {type IReadonlyTransform} from '../../geo/transform_interface';
import {type Sky} from '../../style/sky';
import {getMercatorHorizon} from '../../geo/projection/mercator_utils';

export type SkyUniformsType = {
    'u_sky_color': UniformColor;
    'u_horizon_color': UniformColor;
    'u_horizon': Uniform2f;
    'u_horizon_normal': Uniform2f;
    'u_sky_horizon_blend': Uniform1f;
    'u_sky_blend': Uniform1f;
};

const skyUniforms = (context: Context, locations: UniformLocations): SkyUniformsType => ({
    'u_sky_color': new UniformColor(context, locations.u_sky_color),
    'u_horizon_color': new UniformColor(context, locations.u_horizon_color),
    'u_horizon': new Uniform2f(context, locations.u_horizon),
    'u_horizon_normal': new Uniform2f(context, locations.u_horizon_normal),
    'u_sky_horizon_blend': new Uniform1f(context, locations.u_sky_horizon_blend),
    'u_sky_blend': new Uniform1f(context, locations.u_sky_blend),
});

const skyUniformValues = (sky: Sky, transform: IReadonlyTransform, pixelRatio: number): UniformValues<SkyUniformsType> => {
    const cosRoll = Math.cos(transform.rollInRadians);
    const sinRoll = Math.sin(transform.rollInRadians);
    const mercatorHorizon  = getMercatorHorizon(transform);
    const projectionData = transform.getProjectionData({overscaledTileID: null, applyGlobeMatrix: true, applyTerrainMatrix: true});
    const skyBlend = projectionData.projectionTransition;
    return {
        'u_sky_color': sky.properties.get('sky-color'),
        'u_horizon_color': sky.properties.get('horizon-color'),
        'u_horizon': [(transform.width / 2 - mercatorHorizon * sinRoll)  * pixelRatio,
            (transform.height / 2 + mercatorHorizon * cosRoll) * pixelRatio],
        'u_horizon_normal': [-sinRoll, cosRoll],
        'u_sky_horizon_blend': (sky.properties.get('sky-horizon-blend') * transform.height / 2) * pixelRatio,
        'u_sky_blend': skyBlend,
    };
};

export {skyUniforms, skyUniformValues};

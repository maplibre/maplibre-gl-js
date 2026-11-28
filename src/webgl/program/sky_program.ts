import {UniformColor, Uniform1f, Uniform2f, Uniform3f, UniformMatrix4f} from '../uniform_binding.ts';
import {getMercatorHorizon} from '../../geo/projection/mercator_utils.ts';
import {getAtmosphereAltitudeBlend, getGlobeCenterInViewSpace, getGlobeRadiusPixels} from '../../geo/projection/globe_utils.ts';
import {vec3} from 'gl-matrix';
import {getCameraMath} from '../../camera/camera_math_factory.ts';
import {renderedProjectedCamera} from '../../camera/projected_camera.ts';

import type {SkyPropsPossiblyEvaluated} from '../../style/sky_properties.g.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {Context} from '../../webgl/context.ts';
import type {ProjectedCamera} from '../../camera/projected_camera.ts';

export type SkyUniformsType = {
    'u_sky_color': UniformColor;
    'u_horizon_color': UniformColor;
    'u_horizon': Uniform2f;
    'u_horizon_normal': Uniform2f;
    'u_sky_horizon_blend': Uniform1f;
    'u_sky_blend': Uniform1f;
    'u_inv_proj_matrix': UniformMatrix4f;
    'u_globe_position': Uniform3f;
    'u_globe_radius': Uniform1f;
    'u_atmosphere_blend': Uniform1f;
};

const skyUniforms = (context: Context, locations: UniformLocations): SkyUniformsType => ({
    'u_sky_color': new UniformColor(context, locations.u_sky_color),
    'u_horizon_color': new UniformColor(context, locations.u_horizon_color),
    'u_horizon': new Uniform2f(context, locations.u_horizon),
    'u_horizon_normal': new Uniform2f(context, locations.u_horizon_normal),
    'u_sky_horizon_blend': new Uniform1f(context, locations.u_sky_horizon_blend),
    'u_sky_blend': new Uniform1f(context, locations.u_sky_blend),
    'u_inv_proj_matrix': new UniformMatrix4f(context, locations.u_inv_proj_matrix),
    'u_globe_position': new Uniform3f(context, locations.u_globe_position),
    'u_globe_radius': new Uniform1f(context, locations.u_globe_radius),
    'u_atmosphere_blend': new Uniform1f(context, locations.u_atmosphere_blend),
});

/** Minimum `sin(pitch)` for projecting the ground far plane onto the screen without dividing near 0 or 180 degrees. */
const MIN_PITCH_SIN = 1e-6;

/** CSS-pixel overlap behind the ground far-clip edge so the sky leaves no transparent 1-pixel crack. */
const HORIZON_OVERLAP_PX = 1;

/**
 * Pixel height of the mercator sky horizon above screen center, matching where the ground meets the far clipping
 * plane when `farZ` reaches past `getMercatorHorizon` (for example at high zoom or pitch above 90 degrees).
 */
function getMercatorSkyHorizon(projectedCamera: ProjectedCamera): number {
    const mercatorHorizon = getMercatorHorizon(projectedCamera);
    const rendered = renderedProjectedCamera(projectedCamera);
    if (rendered.projection !== 'mercator') return mercatorHorizon;
    const sinPitch = Math.sin(rendered.pitchInRadians);
    if (sinPitch <= MIN_PITCH_SIN) return mercatorHorizon;
    const cosPitch = Math.cos(rendered.pitchInRadians);
    const groundElevation = Math.min(0, rendered.elevation, rendered.minElevationForCurrentTile);
    const cameraHeightPx = rendered.cameraToCenterDistance * cosPitch + (rendered.elevation - groundElevation) * rendered.pixelsPerMeter;
    if (cameraHeightPx <= 0) return mercatorHorizon;
    const farHorizon = rendered.cameraToCenterDistance * (cosPitch - cameraHeightPx / rendered.farZ) / sinPitch - HORIZON_OVERLAP_PX;
    return Math.max(mercatorHorizon, farHorizon);
}

const skyUniformValues = (sky: Readonly<SkyPropsPossiblyEvaluated>, projectedCamera: ProjectedCamera, pixelRatio: number): UniformValues<SkyUniformsType> => {
    const cosRoll = Math.cos(projectedCamera.rollInRadians);
    const sinRoll = Math.sin(projectedCamera.rollInRadians);
    const mercatorHorizon = getMercatorSkyHorizon(projectedCamera);
    const projectionData = getCameraMath(projectedCamera).getProjectionData(projectedCamera, {overscaledTileID: null, applyGlobeMatrix: true, applyTerrainMatrix: true});
    const skyBlend = projectionData.projectionTransition;
    const globePosition = getGlobeCenterInViewSpace(projectedCamera);
    const globeRadius = getGlobeRadiusPixels(projectedCamera.worldSize, projectedCamera.center.lat);
    return {
        'u_sky_color': sky['sky-color'],
        'u_horizon_color': sky['horizon-color'],
        'u_horizon': [(projectedCamera.width / 2 - mercatorHorizon * sinRoll)  * pixelRatio,
            (projectedCamera.height / 2 + mercatorHorizon * cosRoll) * pixelRatio],
        'u_horizon_normal': [-sinRoll, cosRoll],
        'u_sky_horizon_blend': (sky['sky-horizon-blend'] * projectedCamera.height / 2) * pixelRatio,
        'u_sky_blend': skyBlend,
        'u_inv_proj_matrix': projectedCamera.inverseProjectionMatrix,
        'u_globe_position': globePosition,
        'u_globe_radius': globeRadius,
        'u_atmosphere_blend': sky['atmosphere-blend'] * getAtmosphereAltitudeBlend(vec3.length(globePosition) - globeRadius, globeRadius),
    };
};

export {skyUniforms, skyUniformValues};

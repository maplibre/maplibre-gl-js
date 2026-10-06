import {StencilMode} from '../stencil_mode.ts';
import {DepthMode} from '../depth_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {skyUniformValues} from '../program/sky_program.ts';
import {atmosphereUniformValues} from '../program/atmosphere_program.ts';
import {getAtmosphereAltitudeBlend, getGlobeCenterInViewSpace, getGlobeRadiusPixels} from '../../geo/projection/globe_utils.ts';
import {mat4, vec3} from 'gl-matrix';
import {ColorMode} from '../color_mode.ts';
import {sphericalToCartesian} from '../../util/util.ts';

import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {LightPropsPossiblyEvaluated} from '../../style/light_properties.g.ts';
import type {IReadonlyTransform} from '../../geo/transform_interface.ts';
import type {Painter} from '../../render/painter.ts';

export function drawSky(painter: Painter, frameRenderContext: FrameRenderContext): void {
    const context = painter.context;
    const gl = context.gl;
    const {sky, pixelRatio} = frameRenderContext.data;

    const skyUniforms = skyUniformValues(sky, frameRenderContext.transform, pixelRatio);

    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const stencilMode = StencilMode.disabled;
    const colorMode = frameRenderContext.colorModeForRenderPass();
    const program = frameRenderContext.useProgram('sky');

    const mesh = painter.skyMesh;

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode,
        CullFaceMode.disabled, skyUniforms, null, undefined, 'sky', mesh.vertexBuffer,
        mesh.indexBuffer, mesh.segments);
}

function getSunPos(light: Readonly<LightPropsPossiblyEvaluated>, transform: IReadonlyTransform): vec3 {
    const lightPos = sphericalToCartesian(light.position);
    vec3.negate(lightPos, lightPos);

    const lightMat = mat4.identity(new Float64Array(16));

    if (light.anchor === 'map') {
        mat4.rotateZ(lightMat, lightMat, transform.rollInRadians);
        mat4.rotateX(lightMat, lightMat, -transform.pitchInRadians);
        mat4.rotateZ(lightMat, lightMat, transform.bearingInRadians);
        mat4.rotateX(lightMat, lightMat, transform.center.lat * Math.PI / 180.0);
        mat4.rotateY(lightMat, lightMat, -transform.center.lng * Math.PI / 180.0);
    }

    vec3.transformMat4(lightPos, lightPos, lightMat);

    return lightPos;
}

export function drawAtmosphere(painter: Painter, frameRenderContext: FrameRenderContext): void {
    const context = painter.context;
    const gl = context.gl;
    const {sky, light} = frameRenderContext.data;
    const program = frameRenderContext.useProgram('atmosphere');
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);
    const transform = frameRenderContext.transform;

    const sunPos = getSunPos(light, transform);

    const projectionData = transform.getProjectionData({overscaledTileID: null, applyGlobeMatrix: true, applyTerrainMatrix: true});
    const globeRadius = getGlobeRadiusPixels(transform.worldSize, transform.center.lat);
    const globePosition = getGlobeCenterInViewSpace(transform);
    const altitudeBlend = getAtmosphereAltitudeBlend(vec3.length(globePosition) - globeRadius, globeRadius);
    const atmosphereBlend = sky['atmosphere-blend'] * projectionData.projectionTransition * altitudeBlend;

    if (atmosphereBlend === 0) {
        // Don't draw anything if atmosphere is fully transparent
        return;
    }

    const uniformValues = atmosphereUniformValues(sunPos, atmosphereBlend, globePosition, globeRadius, transform.inverseProjectionMatrix);

    const mesh = painter.skyMesh;

    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.alphaBlended, CullFaceMode.disabled, uniformValues, null, null, 'atmosphere', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
}

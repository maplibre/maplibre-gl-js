import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {atmosphereUniformValues} from './program/atmosphere_program';

import type {Painter} from './painter';
import {ColorMode} from '../gl/color_mode';
import {Atmosphere} from './atmosphere';

export function drawAtmosphere(painter: Painter, atmosphere: Atmosphere) {
    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('atmosphere');
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);

    const projection = painter.style.map.projection;
    const projectionData = projection.getProjectionData(null, null);

    const sunPos = atmosphere.getSunPos();

    const atmosphereBlend = atmosphere.getAtmosphereBlend();
    if (atmosphereBlend === 0) {
        // Dont draw anythink if atmosphere is fully transparent
        return;
    }

    const globePosition = projection.globePosition;
    const globeRadius = projection.globeRadius;
    const invProjMatrix = projection.invProjMatrix;

    const uniformValues = atmosphereUniformValues(sunPos, atmosphereBlend, globePosition, globeRadius, invProjMatrix);
    const mesh = atmosphere.getAtmosphereMesh();

    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.alphaBlended, CullFaceMode.disabled, uniformValues, null, projectionData, 'atmosphere', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
}

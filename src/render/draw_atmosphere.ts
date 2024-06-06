import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {atmosphereUniformValues} from './program/atmosphere_program';

import type {Painter} from './painter';
import {ColorMode} from '../gl/color_mode';
import Sky from '../style/sky';
import {Light} from '../style/light';
import {AtmosphereBoundsArray, TriangleIndexArray} from '../data/array_types.g';
import {atmosphereAttributes} from '../data/atmosphere_attributes';
import {Mesh} from './mesh';
import {SegmentVector} from '../data/segment';

export function drawAtmosphere(painter: Painter, sky: Sky, light: Light) {
    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('atmosphere');
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);

    const projection = painter.style.map.projection;
    const projectionData = projection.getProjectionData(null, null);

    const sunPos = light.getSunPos(painter.transform);

    const atmosphereBlend = sky.getAtmosphereBlend();
    if (atmosphereBlend === 0) {
        // Dont draw anythink if atmosphere is fully transparent
        return;
    }

    const globePosition = projection.worldCenterPosition;
    const globeRadius = projection.worldSize;
    const invProjMatrix = projection.invProjMatrix;

    const uniformValues = atmosphereUniformValues(sunPos, atmosphereBlend, globePosition, globeRadius, invProjMatrix);

    // Create the atmosphere mesh the first time we need it
    if (!sky.atmosphereMesh) {
        const vertexArray = new AtmosphereBoundsArray();
        vertexArray.emplaceBack(-1, -1, 0.0, 1.0);
        vertexArray.emplaceBack(+1, -1, 0.0, 1.0);
        vertexArray.emplaceBack(+1, +1, 0.0, 1.0);
        vertexArray.emplaceBack(-1, +1, 0.0, 1.0);

        const indexArray = new TriangleIndexArray();
        indexArray.emplaceBack(0, 1, 2);
        indexArray.emplaceBack(0, 2, 3);

        sky.atmosphereMesh = new Mesh(
            context.createVertexBuffer(vertexArray, atmosphereAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );
    }

    const mesh = sky.atmosphereMesh;

    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.alphaBlended, CullFaceMode.disabled, uniformValues, null, projectionData, 'atmosphere', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
}

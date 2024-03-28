import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {PosArray, TriangleIndexArray} from '../data/array_types.g';
import posAttributes from '../data/pos_attributes';
import {SegmentVector} from '../data/segment';
import {skyUniformValues} from './program/sky_program';
import {Sky} from '../style/sky';
import {Mesh} from './mesh';
import type {Painter} from './painter';

export function drawSky(painter: Painter, sky: Sky) {
    const context = painter.context;
    const gl = context.gl;

    const skyUniforms = skyUniformValues(sky, painter.style.map.transform, painter.pixelRatio);

    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const program = painter.useProgram('sky');

    if (!sky.mesh) {
        const vertexArray = new PosArray();
        vertexArray.emplaceBack(-1, -1);
        vertexArray.emplaceBack(1, -1);
        vertexArray.emplaceBack(1, 1);
        vertexArray.emplaceBack(-1, 1);

        const indexArray = new TriangleIndexArray();
        indexArray.emplaceBack(0, 1, 2);
        indexArray.emplaceBack(0, 2, 3);

        sky.mesh = new Mesh(
            context.createVertexBuffer(vertexArray, posAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );
    }

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode,
        CullFaceMode.disabled, skyUniforms, undefined, 'sky', sky.mesh.vertexBuffer,
        sky.mesh.indexBuffer, sky.mesh.segments);
}

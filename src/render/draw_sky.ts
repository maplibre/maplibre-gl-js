import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {PosArray, TriangleIndexArray} from '../data/array_types.g';
import posAttributes from '../data/pos_attributes';
import {SegmentVector} from '../data/segment';
import {skyUniformValues} from './program/sky_program';
import {Sky} from '../style/sky';
import type {Painter} from './painter';

let skyMeshCache = null;

export function drawSky(painter: Painter, sky: Sky) {
    const context = painter.context;
    const gl = context.gl;

    const skyUniforms = skyUniformValues(sky, painter.style.map.transform, painter.pixelRatio);

    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const program = painter.useProgram('sky');

    if (!skyMeshCache) {
        const vertexArray = new PosArray();
        vertexArray.emplaceBack(-1, -1);
        vertexArray.emplaceBack(1, -1);
        vertexArray.emplaceBack(1, 1);
        vertexArray.emplaceBack(-1, 1);

        const indexArray = new TriangleIndexArray();
        indexArray.emplaceBack(0, 1, 2);
        indexArray.emplaceBack(0, 2, 3);

        skyMeshCache = {
            vertexBuffer: context.createVertexBuffer(vertexArray, posAttributes.members),
            indexBuffer: context.createIndexBuffer(indexArray),
            segments: SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        };
    }

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode,
        CullFaceMode.disabled, skyUniforms, undefined, 'sky', skyMeshCache.vertexBuffer,
        skyMeshCache.indexBuffer, skyMeshCache.segments);
}

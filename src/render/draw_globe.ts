import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {globeUniformValues} from './program/globe_program';
import type {Painter} from './painter';
import {CullFaceMode} from '../gl/cull_face_mode';
import {OverscaledTileID} from '../source/tile_id';
import {Globe} from './globe';
import {mat4} from 'gl-matrix';

function drawGlobe(painter: Painter, globe: Globe, tileIDs: Array<OverscaledTileID>) {
    const context = painter.context;
    const gl = context.gl;
    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const program = painter.useProgram('globe');

    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);

    //const posMatrix = new Float64Array(16) as any;
    //mat4.identity(posMatrix);
    const posMatrix = globe.cachedTransform;

    for (const tileID of tileIDs) {
        const texture = painter.renderToTexture.getTexture(tileID.key);
        const mesh = globe.getMesh(tileID.key);
        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
        //const posMatrix = painter.transform.calculatePosMatrix(tileID.toUnwrapped());
        const uniformValues = globeUniformValues(posMatrix, painter.renderToTexture.getTileColorForDebug(tileID.key));
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, null, null, 'globe', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}

export {
    drawGlobe
};

import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {skyUniformValues} from './program/sky_program';
import type Painter from './painter';
import Sky from '../style/sky';

export default drawSky;

function drawSky(painter: Painter, sky: Sky) {
    const context = painter.context;
    const gl = context.gl;

    const skyUniforms = skyUniformValues(sky, painter.style.map.transform, painter.pixelRatio);

    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const program = painter.useProgram('sky');

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode,
        CullFaceMode.disabled, skyUniforms, undefined, 'sky', sky.vertexBuffer,
        sky.indexBuffer, sky.segments);
}

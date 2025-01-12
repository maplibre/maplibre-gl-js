import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';

import type {Painter, RenderOptions} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {CustomRenderMethodInput, CustomStyleLayer} from '../style/style_layer/custom_style_layer';

export function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer, renderOptions: RenderOptions) {

    const {isRenderingGlobe} = renderOptions;
    const context = painter.context;
    const implementation = layer.implementation;
    const projection = painter.style.projection;
    const transform = painter.transform;

    const projectionData = transform.getProjectionDataForCustomLayer(isRenderingGlobe);

    const customLayerArgs: CustomRenderMethodInput = {
        farZ: transform.farZ,
        nearZ: transform.nearZ,
        fov: transform.fov * Math.PI / 180, // fov converted to radians
        modelViewProjectionMatrix: transform.modelViewProjectionMatrix,
        projectionMatrix: transform.projectionMatrix,
        shaderData: {
            variantName: projection.shaderVariantName,
            vertexShaderPrelude: `const float PI = 3.141592653589793;\nuniform mat4 u_projection_matrix;\n${projection.shaderPreludeCode.vertexSource}`,
            define: projection.shaderDefine,
        },
        defaultProjectionData: projectionData,
    };

    const renderingMode = implementation.renderingMode ? implementation.renderingMode : '2d';

    if (painter.renderPass === 'offscreen') {
        const prerender = implementation.prerender;
        if (prerender) {
            painter.setCustomLayerDefaults();
            context.setColorMode(painter.colorModeForRenderPass());

            prerender.call(implementation, context.gl, customLayerArgs);

            context.setDirty();
            painter.setBaseState();
        }
    } else if (painter.renderPass === 'translucent') {

        painter.setCustomLayerDefaults();

        context.setColorMode(painter.colorModeForRenderPass());
        context.setStencilMode(StencilMode.disabled);

        const depthMode = renderingMode === '3d' ?
            painter.getDepthModeFor3D() :
            painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);

        context.setDepthMode(depthMode);

        implementation.render(context.gl, customLayerArgs);

        context.setDirty();
        painter.setBaseState();
        context.bindFramebuffer.set(null);
    }
}

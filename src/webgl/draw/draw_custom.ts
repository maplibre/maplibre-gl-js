import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';

import type {Painter, RenderOptions} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {CustomLayerProjectionDataParams, CustomRenderMethodInput, CustomStyleLayer} from '../../style/style_layer/custom_style_layer.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';

export function drawCustom(painter: Painter, tileManager: TileManager, layer: CustomStyleLayer, renderOptions: RenderOptions): void {

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
        getProjectionData: (params: CustomLayerProjectionDataParams) => {
            return transform.getProjectionData({
                overscaledTileID: new OverscaledTileID(
                    params.tileID.canonical.z,
                    params.tileID.wrap ?? 0,
                    params.tileID.canonical.z,
                    params.tileID.canonical.x,
                    params.tileID.canonical.y,
                ),
                // Custom layers are not gated on `painter.options.moving` the way the raster paths are:
                // a layer that asks for the aligned matrix keeps getting it while the camera moves, as before.
                // The `rasterPixelAlignment` map option still turns it off, so a custom layer cannot end up
                // aligned while the raster layers around it are not.
                aligned: params.aligned && painter.options.rasterPixelAlignment,
                applyGlobeMatrix: params.applyGlobeMatrix,
                applyTerrainMatrix: params.applyTerrainMatrix,
            });
        }
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

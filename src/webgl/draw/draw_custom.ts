import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {drawTerrainHeightMap} from './draw_terrain.ts';

import type {Painter} from '../../render/painter.ts';
import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {CustomLayerProjectionDataParams, CustomRenderMethodInput, CustomStyleLayer} from '../../style/style_layer/custom_style_layer.ts';
import type {TerrainHeightMapTarget} from '../../render/terrain.ts';

export function drawCustom(painter: Painter, tileManager: TileManager, layer: CustomStyleLayer, frameRenderContext: FrameRenderContext): void {

    const {isRenderingGlobe} = frameRenderContext.data;
    const {terrain} = frameRenderContext;
    const context = painter.context;
    const implementation = layer.implementation;
    const projection = painter.style.projection;
    const transform = frameRenderContext.transform;

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
                aligned: params.aligned,
                applyGlobeMatrix: params.applyGlobeMatrix,
                applyTerrainMatrix: params.applyTerrainMatrix,
            });
        },
        renderTerrainHeightMap: terrain ? (target: TerrainHeightMapTarget) => drawTerrainHeightMap(frameRenderContext, terrain, target) : undefined
    };

    const renderingMode = implementation.renderingMode ? implementation.renderingMode : '2d';

    if (frameRenderContext.currentPass === 'offscreen') {
        const prerender = implementation.prerender;
        if (prerender) {
            painter.setCustomLayerDefaults();
            context.setColorMode(frameRenderContext.colorModeForRenderPass());

            prerender.call(implementation, context.gl, customLayerArgs);

            context.setDirty();
            painter.setBaseState();
        }
    } else if (frameRenderContext.currentPass === 'translucent') {

        painter.setCustomLayerDefaults();

        context.setColorMode(frameRenderContext.colorModeForRenderPass());
        context.setStencilMode(StencilMode.disabled);

        const depthMode = renderingMode === '3d' ?
            frameRenderContext.getDepthModeFor3D() :
            frameRenderContext.getDepthModeForSublayer(0, DepthMode.ReadOnly);

        context.setDepthMode(depthMode);

        implementation.render(context.gl, customLayerArgs);

        context.setDirty();
        painter.setBaseState();
        context.bindFramebuffer.set(null);
    }
}

import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';

import type {Painter} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {CustomStyleLayer} from '../style/style_layer/custom_style_layer';
import {OverscaledTileID} from '../source/tile_id';
import {CustomLayerArgs} from '../geo/transform_helper';
import {createMat4f64} from '../util/util';
import {mat4} from 'gl-matrix';
import {EXTENT} from '../data/extent';

export function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer) {

    const context = painter.context;
    const implementation = layer.implementation;
    const projection = painter.style.projection;
    const transform = painter.transform;

    const projectionData = transform.getProjectionData(new OverscaledTileID(0, 0, 0, 0, 0));

    // Even though we requested projection data for the mercator base tile which covers the entire mercator range,
    // the shader projection machinery still expects inputs to be in tile units range [0..EXTENT].
    // Since custom layers are expected to supply mercator coordinates [0..1], we need to rescale
    // the fallback projection matrix by EXTENT.
    // Note that the regular projection matrices do not need to be modified, since the rescaling happens by setting
    // the `u_projection_tile_mercator_coords` uniform correctly later.
    const fallbackMatrixScaled = createMat4f64();
    mat4.scale(fallbackMatrixScaled, projectionData.u_projection_fallback_matrix, [EXTENT, EXTENT, 1]);

    const transformArgs = transform.getCustomLayerArgs();

    const customLayerArgs: CustomLayerArgs = {
        farZ: transform.farZ,
        nearZ: transform.nearZ,
        fov: transform.fov * Math.PI / 180, // fov converted to radians
        modelViewProjectionMatrix: transform.modelViewProjectionMatrix,
        projectionMatrix: transform.projectionMatrix,
        shader: {
            variantName: projection.shaderVariantName,
            vertexShaderPrelude: `const float PI = 3.141592653589793;\nuniform mat4 u_projection_matrix;\n${projection.shaderPreludeCode.vertexSource}`,
            define: projection.shaderDefine,
        },
        // Convert all uniforms to plain arrays
        uniforms: {
            'u_projection_matrix': [...projectionData.u_projection_matrix.values()],
            // This next uniform is used to convert from [0..EXTENT] to [0..1] mercator coordinates for a given tile,
            // but since custom layers are expected to already supply mercator coordinates, it is set to identity (offset 0,0 and scale 1,1).
            'u_projection_tile_mercator_coords': [0, 0, 1, 1],
            'u_projection_clipping_plane': [...projectionData.u_projection_clipping_plane.values()],
            'u_projection_transition': projectionData.u_projection_transition,
            'u_projection_fallback_matrix': [...fallbackMatrixScaled.values()],
        },
        // The following should be filled in by the transform.
        getSubdivisionForZoomLevel: (zoomLevel): number => {
            return projection.subdivisionGranularity.tile.getGranularityForZoomLevel(zoomLevel);
        },
        getMatrixForModel: transformArgs.getMatrixForModel,
        getMercatorTileProjectionMatrix: transformArgs.getMercatorTileProjectionMatrix,
    };

    const customLayerMatrix = transform.customLayerMatrix();

    if (painter.renderPass === 'offscreen') {

        const prerender = implementation.prerender;
        if (prerender) {
            painter.setCustomLayerDefaults();
            context.setColorMode(painter.colorModeForRenderPass());

            prerender.call(implementation, context.gl, customLayerMatrix, customLayerArgs);

            context.setDirty();
            painter.setBaseState();
        }

    } else if (painter.renderPass === 'translucent') {

        painter.setCustomLayerDefaults();

        context.setColorMode(painter.colorModeForRenderPass());
        context.setStencilMode(StencilMode.disabled);

        const depthMode = implementation.renderingMode === '3d' ?
            new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D) :
            painter.depthModeForSublayer(0, DepthMode.ReadOnly);

        context.setDepthMode(depthMode);

        implementation.render(context.gl, customLayerMatrix, customLayerArgs);

        context.setDirty();
        painter.setBaseState();
        context.bindFramebuffer.set(null);
    }
}

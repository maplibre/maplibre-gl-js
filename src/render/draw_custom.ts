export default drawCustom;

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type CustomStyleLayer from '../style/style_layer/custom_style_layer';
import type {OverscaledTileID} from '../source/tile_id';

function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer, tileIDs: Array<OverscaledTileID>) {    
    const context = painter.context;
    const implementation = layer.implementation;
    
    const tiles = tileIDs.map(tileID => sourceCache.getTile(tileID))

    if (painter.renderPass === 'offscreen') {

        const prerender = implementation.prerender;
        if (prerender) {
            painter.setCustomLayerDefaults();
            context.setColorMode(painter.colorModeForRenderPass());

            prerender.call(implementation, context.gl, painter.transform.customLayerMatrix(), tiles);

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

        implementation.render(context.gl, painter.transform.customLayerMatrix(), tiles);

        context.setDirty();
        painter.setBaseState();
        context.bindFramebuffer.set(null);
    }
}

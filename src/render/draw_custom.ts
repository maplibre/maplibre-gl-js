export default drawCustom;

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import CustomStyleLayer, {TileData} from '../style/style_layer/custom_style_layer';
import type {OverscaledTileID} from '../source/tile_id';

function drawCustom(painter: Painter, sourceCache: SourceCache | undefined, layer: CustomStyleLayer, tileIDs: Array<OverscaledTileID> | undefined) {
    const context = painter.context;
    const implementation = layer.implementation;

    let tiles: TileData[] = [];
    // passing tile-data to custom-layer if layer has source
    if (sourceCache !== undefined && tileIDs !== undefined) {
        tiles = tileIDs.map(tileID => {
            console.log('aaa', sourceCache.getTile(tileID))
            return {
                tileIndex: [
                    tileID.canonical.x,
                    tileID.canonical.y,
                    tileID.canonical.z,
                ],
                texture: sourceCache.getTile(tileID).texture.texture
            }
        });
    }

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

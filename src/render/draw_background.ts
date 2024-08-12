import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {
    backgroundUniformValues,
    backgroundPatternUniformValues
} from './program/background_program';

import type {Painter} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {BackgroundStyleLayer} from '../style/style_layer/background_style_layer';
import {OverscaledTileID} from '../source/tile_id';

export function drawBackground(painter: Painter, sourceCache: SourceCache, layer: BackgroundStyleLayer, coords?: Array<OverscaledTileID>) {
    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');

    if (opacity === 0) return;

    const context = painter.context;
    const gl = context.gl;
    const projection = painter.style.projection;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const image = layer.paint.get('background-pattern');
    if (painter.isPatternMissing(image)) return;

    const pass = (!image && color.a === 1 && opacity === 1 && painter.opaquePassEnabledForLayer()) ? 'opaque' : 'translucent';
    if (painter.renderPass !== pass) return;

    const stencilMode = StencilMode.disabled;
    const depthMode = painter.depthModeForSublayer(0, pass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();
    const program = painter.useProgram(image ? 'backgroundPattern' : 'background');
    const tileIDs = coords ? coords : transform.coveringTiles({tileSize, terrain: painter.style.map.terrain});

    if (image) {
        context.activeTexture.set(gl.TEXTURE0);
        painter.imageManager.bind(painter.context);
    }

    const crossfade = layer.getCrossfadeParameters();

    for (const tileID of tileIDs) {
        const projectionData = transform.getProjectionData(tileID);

        const uniformValues = image ?
            backgroundPatternUniformValues(opacity, painter, image, {tileID, tileSize}, crossfade) :
            backgroundUniformValues(opacity, color);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(tileID);

        // For globe rendering, background uses tile meshes *without* borders and no stencil clipping.
        // This works assuming the tileIDs list contains only tiles of the same zoom level.
        // This seems to always be the case for background layers, but I'm leaving this comment
        // here in case this assumption is false in the future.

        // In case background starts having tiny holes at tile boundaries, switch to meshes with borders
        // and also enable stencil clipping. Make sure to render a proper tile clipping mask into stencil
        // first though, as that doesn't seem to happen for background layers as of writing this.

        const mesh = projection.getMeshFromTileID(context, tileID.canonical, false, true, 'raster');
        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, terrainData, projectionData, layer.id,
            mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}

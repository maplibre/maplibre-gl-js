import {Texture} from '../texture.ts';
import {StencilMode} from '../stencil_mode.ts';
import {DepthMode} from '../depth_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
} from '../program/hillshade_program.ts';

import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {ColorMode} from '../color_mode.ts';
import type {Painter} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {HillshadeStyleLayer} from '../../style/style_layer/hillshade_style_layer.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

export function drawHillshade(painter: Painter, tileManager: TileManager, layer: HillshadeStyleLayer, tileIDs: OverscaledTileID[], frameRenderContext: FrameRenderContext): void {
    if (frameRenderContext.currentPass !== 'offscreen' && frameRenderContext.currentPass !== 'translucent') return;

    const context = frameRenderContext.context;
    const {useSubdivision} = frameRenderContext.data;

    const depthMode = frameRenderContext.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = frameRenderContext.colorModeForRenderPass();

    if (frameRenderContext.currentPass === 'offscreen') {
        // Prepare tiles
        prepareHillshade(painter, tileManager, tileIDs, layer, depthMode, StencilMode.disabled, colorMode, frameRenderContext);
        context.viewport.set([0, 0, painter.width, painter.height]);
    } else if (frameRenderContext.currentPass === 'translucent') {
        // Globe (or any projection with subdivision) needs two-pass rendering to avoid artifacts when rendering texture tiles.
        // See comments in draw_raster.ts for more details.
        if (useSubdivision) {
            // Two-pass rendering
            const [stencilBorderless, stencilBorders, coords] = frameRenderContext.stencilConfigForOverlapTwoPass(tileIDs);
            renderHillshade(tileManager, layer, coords, stencilBorderless, depthMode, colorMode, false, frameRenderContext); // draw without borders
            renderHillshade(tileManager, layer, coords, stencilBorders, depthMode, colorMode, true, frameRenderContext); // draw with borders
        } else {
            // Simple rendering
            const [stencil, coords] = frameRenderContext.getStencilConfigForOverlapAndUpdateStencilID(tileIDs);
            renderHillshade(tileManager, layer, coords, stencil, depthMode, colorMode, false, frameRenderContext);
        }
    }
}

function renderHillshade(
    tileManager: TileManager,
    layer: HillshadeStyleLayer,
    coords: OverscaledTileID[],
    stencilModes: {[_: number]: Readonly<StencilMode>},
    depthMode: Readonly<DepthMode>,
    colorMode: Readonly<ColorMode>,
    useBorder: boolean,
    frameRenderContext: FrameRenderContext
) {
    const context = frameRenderContext.context;
    const gl = context.gl;

    const defines = [`#define NUM_ILLUMINATION_SOURCES ${layer.paint.get('hillshade-highlight-color').values.length}`];
    const program = frameRenderContext.useProgram('hillshade', null, false, defines);
    const align = !frameRenderContext.data.moving;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const fbo = tile.fbo;
        if (!fbo) {
            continue;
        }
        const mesh = frameRenderContext.getMeshFromTileID(coord.canonical, useBorder, true, 'raster');

        const terrainData = frameRenderContext.getTerrainDataForTile(coord);

        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

        const projectionData = frameRenderContext.getProjectionDataForTile(coord, {aligned: align});

        program.draw(context, gl.TRIANGLES, depthMode, stencilModes[coord.overscaledZ], colorMode, CullFaceMode.backCCW,
            hillshadeUniformValues(frameRenderContext.transform, tile, layer), terrainData, projectionData, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}

// hillshade rendering is done in two steps. the prepare step first calculates the slope of the terrain in the x and y
// directions for each pixel, and saves those values to a framebuffer texture in the r and g channels.
function prepareHillshade(
    painter: Painter,
    tileManager: TileManager,
    tileIDs: OverscaledTileID[],
    layer: HillshadeStyleLayer,
    depthMode: Readonly<DepthMode>,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    frameRenderContext: FrameRenderContext) {

    const context = frameRenderContext.context;
    const gl = context.gl;

    const textureFilter = layer.paint.get('resampling') === 'nearest' ?  gl.NEAREST : gl.LINEAR;

    for (const coord of tileIDs) {
        const tile = tileManager.getTile(coord);
        const dem = tile.dem;

        if (!dem?.data) {
            continue;
        }

        if (!tile.needsHillshadePrepare) {
            continue;
        }

        const hillshadeTextureSize = dem.dim + 2;
        const textureStride = dem.stride;

        const pixelData = dem.getPixels();
        context.activeTexture.set(gl.TEXTURE1);

        context.pixelStoreUnpackPremultiplyAlpha.set(false);
        tile.demTexture ||= painter.getTileTexture(textureStride);
        if (tile.demTexture) {
            const demTexture = tile.demTexture;
            demTexture.update(pixelData, {premultiply: false});
            demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        } else {
            tile.demTexture = new Texture(context, pixelData, gl.RGBA, {premultiply: false});
            tile.demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        }

        context.activeTexture.set(gl.TEXTURE0);

        let fbo = tile.fbo;

        if (!fbo) {
            const renderTexture = new Texture(context, {width: hillshadeTextureSize, height: hillshadeTextureSize, data: null}, gl.RGBA);
            renderTexture.bind(textureFilter, gl.CLAMP_TO_EDGE);

            fbo = tile.fbo = context.createFramebuffer(hillshadeTextureSize, hillshadeTextureSize, true, false);
            fbo.colorAttachment.set(renderTexture.texture);
        }

        context.bindFramebuffer.set(fbo.framebuffer);
        context.viewport.set([0, 0, hillshadeTextureSize, hillshadeTextureSize]);

        frameRenderContext.useProgram('hillshadePrepare').draw(context, gl.TRIANGLES,
            depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            hillshadeUniformPrepareValues(tile.tileID, dem),
            null, null, layer.id, painter.rasterBoundsBuffer,
            painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);

        tile.needsHillshadePrepare = false;
    }
}

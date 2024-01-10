import {Texture} from './texture';
import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {ColorMode} from '../gl/color_mode';
import {Tile} from '../source/tile';
import {
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
} from './program/hillshade_program';

import type {Painter} from './painter';
import type {SourceCache} from '../source/source_cache';
import type {HillshadeStyleLayer} from '../style/style_layer/hillshade_style_layer';
import type {OverscaledTileID} from '../source/tile_id';
import {VertexBuffer} from '../gl/vertex_buffer';
import {IndexBuffer} from '../gl/index_buffer';
import {SegmentVector} from '../data/segment';

export function drawHillshade(painter: Painter, sourceCache: SourceCache, layer: HillshadeStyleLayer, tileIDs: Array<OverscaledTileID>, isRenderingToTexture: boolean) {
    if (painter.renderPass !== 'offscreen' && painter.renderPass !== 'translucent') return;

    const context = painter.context;
    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    if (painter.renderPass === 'offscreen') {
        // Prepare tiles
        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            if (typeof tile.needsHillshadePrepare !== 'undefined' && tile.needsHillshadePrepare) {
                prepareHillshade(painter, tile, layer, depthMode, StencilMode.disabled, colorMode);
            }
        }
        context.viewport.set([0, 0, painter.width, painter.height]);
    } else if (painter.renderPass === 'translucent') {
        // Render tiles
        const globe = painter.style.map.globe;

        if (globe) {
            // Globe needs two-pass rendering to avoid artifacts when rendering texture tiles.
            // See comments in draw_raster.ts for more details.
            const [stencilModesHigh, stencilModesLow, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
            for (const coord of coords) {
                const tile = sourceCache.getTile(coord);
                const mesh = painter.style.map.projectionManager.getMeshFromTileID(context, coord.canonical, false);
                renderHillshade(painter, coord, tile, layer, depthMode, stencilModesHigh[coord.overscaledZ], colorMode, isRenderingToTexture,
                    mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
            }
            for (const coord of coords) {
                const tile = sourceCache.getTile(coord);
                const mesh = painter.style.map.projectionManager.getMeshFromTileID(context, coord.canonical, false);
                renderHillshade(painter, coord, tile, layer, depthMode, stencilModesLow[coord.overscaledZ], colorMode, isRenderingToTexture,
                    mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
            }
        } else {
            const [stencilModes, coords] = painter.stencilConfigForOverlap(tileIDs);
            for (const coord of coords) {
                const tile = sourceCache.getTile(coord);
                renderHillshade(painter, coord, tile, layer, depthMode, stencilModes[coord.overscaledZ], colorMode, isRenderingToTexture,
                    painter.rasterBoundsBufferPosOnly, painter.quadTriangleIndexBuffer, painter.rasterBoundsSegmentsPosOnly);
            }
        }
    }
}

function renderHillshade(
    painter: Painter,
    coord: OverscaledTileID,
    tile: Tile,
    layer: HillshadeStyleLayer,
    depthMode: Readonly<DepthMode>,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    isRenderingToTexture: boolean,
    vertexBuffer: VertexBuffer,
    indexBuffer: IndexBuffer,
    segments: SegmentVector) {
    const context = painter.context;
    const gl = context.gl;
    const fbo = tile.fbo;
    if (!fbo) return;

    const program = painter.useProgram('hillshade');
    const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    const align = !painter.options.moving;
    const matrix = isRenderingToTexture ? coord.posMatrix : painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped(), align);
    const projectionData = painter.style.map.projectionManager.getProjectionData(coord, matrix);

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
        hillshadeUniformValues(painter, tile, layer), terrainData, projectionData, layer.id, vertexBuffer, indexBuffer, segments);
}

// hillshade rendering is done in two steps. the prepare step first calculates the slope of the terrain in the x and y
// directions for each pixel, and saves those values to a framebuffer texture in the r and g channels.
function prepareHillshade(
    painter: Painter,
    tile: Tile,
    layer: HillshadeStyleLayer,
    depthMode: Readonly<DepthMode>,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>) {
    const context = painter.context;
    const gl = context.gl;
    const dem = tile.dem;
    if (dem && dem.data) {
        const tileSize = dem.dim;
        const textureStride = dem.stride;

        const pixelData = dem.getPixels();
        context.activeTexture.set(gl.TEXTURE1);

        context.pixelStoreUnpackPremultiplyAlpha.set(false);
        tile.demTexture = tile.demTexture || painter.getTileTexture(textureStride);
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
            const renderTexture = new Texture(context, {width: tileSize, height: tileSize, data: null}, gl.RGBA);
            renderTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

            fbo = tile.fbo = context.createFramebuffer(tileSize, tileSize, true, false);
            fbo.colorAttachment.set(renderTexture.texture);
        }

        context.bindFramebuffer.set(fbo.framebuffer);
        context.viewport.set([0, 0, tileSize, tileSize]);

        painter.useProgram('hillshadePrepare').draw(context, gl.TRIANGLES,
            depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            hillshadeUniformPrepareValues(tile.tileID, dem),
            null, null, layer.id, painter.rasterBoundsBuffer,
            painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);

        tile.needsHillshadePrepare = false;
    }
}

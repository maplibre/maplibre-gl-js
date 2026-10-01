import {StencilMode} from '../stencil_mode.ts';
import {DepthMode} from '../depth_mode.ts';
import {terrainUniformValues, terrainDepthUniformValues, terrainHeightUniformValues} from '../program/terrain_program.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {ColorMode} from '../color_mode.ts';

import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {Terrain, TerrainHeightMapTarget} from '../../render/terrain.ts';
import type {Tile} from '../../tile/tile.ts';
import type {Painter} from '../../render/painter.ts';

/**
 * Redraw the Depth Framebuffer
 * @param painter - the painter
 * @param terrain - the terrain
 */
function drawDepth(painter: Painter, terrain: Terrain): void {
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.frameRenderContext.transform;
    const colorMode = ColorMode.unblended;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const tiles = terrain.tileManager.getRenderableTiles();
    const program = painter.frameRenderContext.useProgram('terrainDepth');
    context.bindFramebuffer.set(terrain.getFramebuffer().framebuffer);
    context.viewport.set([0, 0, painter.width  / devicePixelRatio, painter.height / devicePixelRatio]);
    context.clear({color: Color.white, depth: 1});
    for (const tile of tiles) {
        const mesh = terrain.getTerrainMesh(tile.tileID);
        const terrainData = terrain.getTerrainData(tile.tileID);
        const projectionData = tr.getProjectionData({overscaledTileID: tile.tileID, applyTerrainMatrix: false, applyGlobeMatrix: true});
        const uniformValues = terrainDepthUniformValues(terrain.getSkirtLength(tr.zoom));
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, projectionData, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);
}

function drawTerrain(painter: Painter, terrain: Terrain, tiles: Tile[], frameRenderContext: FrameRenderContext): void {
    const {isRenderingGlobe} = frameRenderContext.data;
    const context = painter.context;
    const gl = context.gl;
    const tr = frameRenderContext.transform;
    const colorMode = frameRenderContext.colorModeForRenderPass();
    const depthMode = frameRenderContext.getDepthModeFor3D();
    const program = frameRenderContext.useProgram('terrain');

    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);

    for (const tile of tiles) {
        const mesh = terrain.getTerrainMesh(tile.tileID);
        const texture = painter.renderToTexture.getTexture(tile);
        const terrainData = terrain.getTerrainData(tile.tileID);
        context.activeTexture.set(gl.TEXTURE0);
        texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_LINEAR);
        const eleDelta = terrain.getSkirtLength(tr.zoom);
        const fogMatrix = tr.calculateFogMatrix(tile.tileID.toUnwrapped());
        const uniformValues = terrainUniformValues(eleDelta, fogMatrix, frameRenderContext.data.sky, tr.pitch, isRenderingGlobe);
        const projectionData = frameRenderContext.getProjectionDataForTile(tile.tileID, {applyTerrainMatrix: false});
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, projectionData, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}

/**
 * Draws the elevation of the loaded renderable terrain tiles into a texture, see {@link CustomRenderMethodInput.renderTerrainHeightMap}.
 */
function drawTerrainHeightMap(frameRenderContext: FrameRenderContext, terrain: Terrain, target: TerrainHeightMapTarget): void {
    const context = frameRenderContext.context;
    const gl = context.gl;
    const [minX, minY, maxX, maxY] = target.bounds;
    context.setDirty();
    const framebuffer = terrain.getHeightMapFramebuffer(target.texture);
    context.viewport.set([0, 0, target.width, target.height]);
    context.clear({color: Color.transparent});

    const program = frameRenderContext.useProgram('terrainHeight', null, true);
    for (const tile of terrain.tileManager.getRenderableTiles()) {
        const terrainData = terrain.getTerrainData(tile.tileID);
        if (!terrainData.tile?.dem) continue;
        const {canonical, wrap} = tile.tileID;
        const tileSize = 1 / (1 << canonical.z);
        const uniformValues = terrainHeightUniformValues([
            (canonical.x * tileSize + wrap - minX) / (maxX - minX),
            (canonical.y * tileSize - minY) / (maxY - minY),
            tileSize / (maxX - minX),
            tileSize / (maxY - minY)
        ]);
        const mesh = terrain.getTerrainMesh(tile.tileID);
        program.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.unblended, CullFaceMode.disabled, uniformValues, terrainData, null, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
    framebuffer.colorAttachment.set(null);
}

export {
    drawTerrain,
    drawDepth,
    drawTerrainHeightMap
};

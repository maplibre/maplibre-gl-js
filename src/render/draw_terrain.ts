import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {terrainUniformValues, terrainDepthUniformValues, terrainCoordsUniformValues} from './program/terrain_program';
import type {Painter} from './painter';
import type {Tile} from '../source/tile';
import {CullFaceMode} from '../gl/cull_face_mode';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {ColorMode} from '../gl/color_mode';
import {Terrain} from './terrain';

/**
 * Redraw the Depth Framebuffer
 * @param painter - the painter
 * @param terrain - the terrain
 */
function drawDepth(painter: Painter, terrain: Terrain) {
    const context = painter.context;
    const gl = context.gl;
    const colorMode = ColorMode.unblended;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const mesh = terrain.getTerrainMesh();
    const tiles = terrain.sourceCache.getRenderableTiles();
    const program = painter.useProgram('terrainDepth');
    context.bindFramebuffer.set(terrain.getFramebuffer('depth').framebuffer);
    context.viewport.set([0, 0, painter.width  / devicePixelRatio, painter.height / devicePixelRatio]);
    context.clear({color: Color.transparent, depth: 1});
    for (const tile of tiles) {
        const terrainData = terrain.getTerrainData(tile.tileID);
        const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
        const uniformValues = terrainDepthUniformValues(posMatrix, terrain.getMeshFrameDelta(painter.transform.zoom));
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);
}

/**
 * Redraw the Coords Framebuffers
 * @param painter - the painter
 * @param terrain - the terrain
 */
function drawCoords(painter: Painter, terrain: Terrain) {
    const context = painter.context;
    const gl = context.gl;
    const colorMode = ColorMode.unblended;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const mesh = terrain.getTerrainMesh();
    const coords = terrain.getCoordsTexture();
    const tiles = terrain.sourceCache.getRenderableTiles();

    // draw tile-coords into framebuffer
    const program = painter.useProgram('terrainCoords');
    context.bindFramebuffer.set(terrain.getFramebuffer('coords').framebuffer);
    context.viewport.set([0, 0, painter.width  / devicePixelRatio, painter.height / devicePixelRatio]);
    context.clear({color: Color.transparent, depth: 1});
    terrain.coordsIndex = [];
    for (const tile of tiles) {
        const terrainData = terrain.getTerrainData(tile.tileID);
        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, coords.texture);
        const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
        const uniformValues = terrainCoordsUniformValues(posMatrix, 255 - terrain.coordsIndex.length, terrain.getMeshFrameDelta(painter.transform.zoom));
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
        terrain.coordsIndex.push(tile.tileID.key);
    }
    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);
}

function drawTerrain(painter: Painter, terrain: Terrain, tiles: Array<Tile>) {
    const context = painter.context;
    const gl = context.gl;
    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const program = painter.useProgram('terrain');
    const mesh = terrain.getTerrainMesh();

    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);

    for (const tile of tiles) {
        const texture = painter.renderToTexture.getTexture(tile);
        const terrainData = terrain.getTerrainData(tile.tileID);
        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
        const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
        const eleDelta = terrain.getMeshFrameDelta(painter.transform.zoom);
        const fogMatrix = painter.transform.calculateFogMatrix(tile.tileID.toUnwrapped());
        const uniformValues = terrainUniformValues(posMatrix, eleDelta, fogMatrix, painter.style.sky, painter.transform.pitch);
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }

}

export {
    drawTerrain,
    drawDepth,
    drawCoords
};

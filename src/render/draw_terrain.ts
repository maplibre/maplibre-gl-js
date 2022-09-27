import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import {terrainUniformValues, terrainDepthUniformValues, terrainCoordsUniformValues} from './program/terrain_program';
import type Painter from './painter';
import type Tile from '../source/tile';
import CullFaceMode from '../gl/cull_face_mode';
import Texture from './texture';
import Color from '../style-spec/util/color';
import ColorMode from '../gl/color_mode';
import Terrain from './terrain';

/**
 * Redraw the Depth Framebuffer
 * @param {Painter} painter - the painter
 * @param {Terrain} terrain - the terrain
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
        const uniformValues = terrainDepthUniformValues(posMatrix);
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);
}

/**
 * Redraw the Coords Framebuffers
 * @param {Painter} painter - the painter
 * @param {Terrain} terrain - the terrain
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
        const uniformValues = terrainCoordsUniformValues(posMatrix, 255 - terrain.coordsIndex.length);
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
        terrain.coordsIndex.push(tile.tileID.key);
    }

    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);
}

/**
 * Render, e.g. drape, a render-to-texture tile onto the 3d mesh on screen.
 * @param {Painter} painter - the painter
 * @param {Terrain} terrain - the source cache
 * @param {Tile} tile - the tile
 */
function drawTerrain(painter: Painter, terrain: Terrain, tile: Tile) {
    const context = painter.context;
    const gl = context.gl;
    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const program = painter.useProgram('terrain');
    const mesh = terrain.getTerrainMesh();
    const terrainData = terrain.getTerrainData(tile.tileID);

    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);
    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, terrain.getRTTFramebuffer().colorAttachment.get());
    const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
    const uniformValues = terrainUniformValues(posMatrix);
    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
}

/**
 * prepare the render-to-texture tile.
 * E.g. creates the necessary textures and attach them to the render-to-texture-framebuffer.
 * @param {Painter} painter - the painter
 * @param {Terrain} terrain - the terrain
 * @param {Tile} tile - the tile
 * @param {number} stack number of a layer-groop. see painter.ts
 */
function prepareTerrain(painter: Painter, terrain: Terrain, tile: Tile, stack: number) {
    const context = painter.context;
    const size = tile.tileSize * terrain.qualityFactor;
    if (!tile.textures[stack]) {
        tile.textures[stack] = painter.getTileTexture(size) || new Texture(context, {width: size, height: size, data: null}, context.gl.RGBA);
        tile.textures[stack].bind(context.gl.LINEAR, context.gl.CLAMP_TO_EDGE);
        if (stack === 0) terrain.sourceCache.renderHistory.unshift(tile.tileID.key);
    }
    const fb = terrain.getRTTFramebuffer();
    fb.colorAttachment.set(tile.textures[stack].texture);
    context.bindFramebuffer.set(fb.framebuffer);
    context.viewport.set([0, 0, size, size]);
}

export {
    prepareTerrain,
    drawTerrain,
    drawDepth,
    drawCoords
};

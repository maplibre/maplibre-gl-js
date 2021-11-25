import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import {terrainUniformValues, terrainDepthUniformValues, terrainCoordsUniformValues} from './program/terrain_program';
import type Painter from './painter';
import type TerrainSourceCache from '../source/terrain_source_cache';
import type Tile from '../source/tile';
import CullFaceMode from '../gl/cull_face_mode';
import Texture from './texture';
import Color from '../style-spec/util/color';
import ColorMode from '../gl/color_mode';

/**
 * Redraw the Coords & Depth Framebuffers
 * @param {Painter} painter
 * @param {sourceCache} sourceCache
 */
function updateTerrainFacilitators(painter, sourceCache: TerrainSourceCache) {
   const context = painter.context;
   const gl = context.gl;
   const colorMode = ColorMode.unblended;
   const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
   const mesh = sourceCache.getTerrainMesh(context);
   const coords = sourceCache.getCoordsTexture(context);
   const tiles = sourceCache.getRenderableTiles();

   // draw tile-coords into framebuffer
   let program = painter.useProgram('terrainCoords');
   context.bindFramebuffer.set(sourceCache.getFramebuffer(painter, "coords").framebuffer);
   context.viewport.set([0, 0, painter.width  / devicePixelRatio, painter.height / devicePixelRatio]);
   context.clear({ color: Color.transparent, depth: 1 });
   sourceCache._coordsIndex = [];
   for (const tile of tiles) {
      const terrain = sourceCache.getTerrain(tile.tileID);
      context.activeTexture.set(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, coords.texture);
      const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
      const uniformValues = terrainCoordsUniformValues(posMatrix, 255 - sourceCache._coordsIndex.length);
      program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrain, "terrain", mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
      sourceCache._coordsIndex.push(tile.tileID.key);
   }

   // draw depth into framebuffer
   program = painter.useProgram('terrainDepth');
   context.bindFramebuffer.set(sourceCache.getFramebuffer(painter, "depth").framebuffer);
   context.viewport.set([0, 0, painter.width  / devicePixelRatio, painter.height / devicePixelRatio]);
   context.clear({ color: Color.transparent, depth: 1 });
   for (const tile of tiles) {
      const terrain = sourceCache.getTerrain(tile.tileID);
      const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
      const uniformValues = terrainDepthUniformValues(posMatrix);
      program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrain, "terrain", mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
   }

   context.bindFramebuffer.set(null);
   context.viewport.set([0, 0, painter.width, painter.height]);
}

/**
 * Render, e.g. drape, a render-to-texture tile onto the 3d mesh on screen.
 * @param {Painter} painter
 * @param {TerrainSourceCache} sourceCache
 * @param {Tile} tile
 */
function drawTerrain(painter: Painter, sourceCache: TerrainSourceCache, tile: Tile) {
   const context = painter.context;
   const gl = context.gl;
   const colorMode = painter.colorModeForRenderPass();
   const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
   const program = painter.useProgram('terrain');
   const mesh = sourceCache.getTerrainMesh(context);
   const terrain = sourceCache.getTerrain(tile.tileID);

   context.bindFramebuffer.set(null);
   context.viewport.set([0, 0, painter.width, painter.height]);
   context.activeTexture.set(gl.TEXTURE0);
   gl.bindTexture(gl.TEXTURE_2D, sourceCache.rttFramebuffer.colorAttachment.get());
   const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
   const uniformValues = terrainUniformValues(posMatrix);
   program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues, terrain, "terrain", mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
}

/**
 * prepare the render-to-texture tile.
 * E.g. creates the necessary textures and attach them to the render-to-texture-framebuffer.
 * @param {Painter} painter
 * @param {TerrainSourceCache} sourceCache
 * @param {Tile} tile
 * @param {number} stack number of a layer-groop. see painter.ts
 */
function prepareTerrain(painter: Painter, sourceCache: TerrainSourceCache, tile: Tile, stack: number) {
   const context = painter.context;
   const size = tile.tileSize * sourceCache.qualityFactor;
   if (!tile.textures[stack]) {
      tile.textures[stack] = painter.getTileTexture(size) || new Texture(context, {width: size, height: size, data: null}, context.gl.RGBA);
      tile.textures[stack].bind(context.gl.LINEAR, context.gl.CLAMP_TO_EDGE);
      if (stack == 0) sourceCache._renderHistory.push(tile.tileID.key);
   }
   sourceCache.rttFramebuffer.colorAttachment.set(tile.textures[stack].texture);
   context.bindFramebuffer.set(sourceCache.rttFramebuffer.framebuffer);
   context.viewport.set([0, 0, size, size]);
}

export {
   prepareTerrain,
   drawTerrain,
   updateTerrainFacilitators
};

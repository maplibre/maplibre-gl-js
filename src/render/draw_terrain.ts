import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import {terrainUniformValues, terrainCoordsUniformValues} from './program/terrain_program';
import type Painter from './painter';
import type TerrainSourceCache from '../source/terrain_source_cache';
import type Tile from '../source/tile';
import CullFaceMode from '../gl/cull_face_mode';
import Texture from './texture';
import Color from '../style-spec/util/color';
import ColorMode from '../gl/color_mode';
import {TerrainElevationArray} from '../data/array_types';
import {createLayout} from '../util/struct_array';

const elevationAttributes = createLayout([
   {name: 'a_ele', components: 1, type: 'Float32'}
], 4);

const FBOs = {};

function drawTerrainCoords(painter, sourceCache: TerrainSourceCache) {
   const context = painter.context;
   const gl = context.gl;
   const colorMode = ColorMode.unblended;
   const program = painter.useProgram('terrainCoords');
   const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
   const mesh = sourceCache.getTerrainMesh(context);
   const coords = sourceCache.getCoordsTexture(context);

   // draw tile-coords into framebuffer
   context.bindFramebuffer.set(sourceCache.getCoordsFramebuffer(painter).framebuffer);
   context.viewport.set([0, 0, painter.width  / devicePixelRatio, painter.height / devicePixelRatio]);
   context.clear({ color: Color.transparent, depth: 1 });

   sourceCache.coordsIndex = [];
   for (const tile of sourceCache.getRenderableTiles(painter.transform)) {
      context.activeTexture.set(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, coords.texture);
      const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
      program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW,
         terrainCoordsUniformValues(painter, posMatrix, 255 - sourceCache.coordsIndex.length), "terrain",
         mesh.vertexBuffer, mesh.indexBuffer, mesh.segments,
         null, null, null, tile.elevationVertexBuffer);
      sourceCache.coordsIndex.push(tile.tileID.key);
   }

   context.bindFramebuffer.set(null);
   context.viewport.set([0, 0, painter.width, painter.height]);
}

function drawTerrain(painter: Painter, sourceCache: TerrainSourceCache, tile: Tile) {
   const context = painter.context;
   const gl = context.gl;
   const colorMode = painter.colorModeForRenderPass();
   const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
   const program = painter.useProgram('terrain');
   const mesh = sourceCache.getTerrainMesh(context);

   context.bindFramebuffer.set(null);
   context.viewport.set([0, 0, painter.width, painter.height]);
   context.activeTexture.set(gl.TEXTURE0);
   gl.bindTexture(gl.TEXTURE_2D, FBOs[tile.tileSize].colorAttachment.get());
   const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
   program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW,
      terrainUniformValues(painter, posMatrix), "terrain",
      mesh.vertexBuffer, mesh.indexBuffer, mesh.segments,
      null, null, null, tile.elevationVertexBuffer);
}

function prepareTerrain(painter: Painter, sourceCache: TerrainSourceCache, tile: Tile, stack: number) {
   const context = painter.context;
   const size = tile.tileSize * sourceCache.qualityFactor; // may increase rendering-size for better quality
   if (!tile.textures[stack]) {
      tile.textures[stack] = new Texture(context, {width: size, height: size, data: null}, context.gl.RGBA);
      tile.textures[stack].bind(context.gl.LINEAR, context.gl.CLAMP_TO_EDGE);
   }
   if (!tile.elevationVertexBuffer) {
      const meshSize = sourceCache.meshSize, vertexArray = new TerrainElevationArray();
      for (let y=0; y<=meshSize; y++) for (let x=0; x<=meshSize; x++) {
         vertexArray.emplaceBack(sourceCache.getElevation(tile.tileID, x, y, meshSize));
      }
      tile.elevationVertexBuffer = context.createVertexBuffer(vertexArray, elevationAttributes.members, true);
   }
   // reuse a framebuffer from the framebuffer-stack and attach active texture
   if (!FBOs[tile.tileSize]) {
      FBOs[tile.tileSize] = context.createFramebuffer(size, size, true);
      FBOs[tile.tileSize].depthAttachment.set(context.createRenderbuffer(context.gl.DEPTH_COMPONENT16, size, size));
   }
   FBOs[tile.tileSize].colorAttachment.set(tile.textures[stack].texture);
   context.bindFramebuffer.set(FBOs[tile.tileSize].framebuffer);
}

export {
   prepareTerrain,
   drawTerrain,
   drawTerrainCoords
};

// @flow

import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import {terrainUniformValues} from './program/terrain_program';
import type Painter from './painter';
import type TerranSourceCache from '../source/terrain_source_cache';
import CullFaceMode from '../gl/cull_face_mode';
import Texture from './texture';
import Color from '../style-spec/util/color';
import ColorMode from '../gl/color_mode';
import browser from '../util/browser';
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
   const program = painter.useProgram('terrain');
   const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);

   // draw tile-coords into framebuffer
   context.bindFramebuffer.set(sourceCache.getCoordsFramebuffer(painter).framebuffer);
   context.viewport.set([0, 0, painter.width  / browser.devicePixelRatio, painter.height / browser.devicePixelRatio]);
   context.clear({ color: Color.transparent, depth: 1 });

   for (const tileID of sourceCache.getRenderableTileIds(painter.transform)) {
      const tile = sourceCache.getTileByID(tileID.key);
      context.activeTexture.set(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tile.coordsTexture.texture);
      const posMatrix = painter.transform.calculatePosMatrix(tileID.toUnwrapped());
      program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW,
          terrainUniformValues(posMatrix), "terrain",
          sourceCache.mesh.vertexBuffer, sourceCache.mesh.indexBuffer, sourceCache.mesh.segments,
          null, null, null, tile.elevationVertexBuffer);
   }
   painter.finishFramebuffer();
}

function drawTerrain(painter: Painter, sourceCache: TerrainSourceCache) {
    const context = painter.context;
    const gl = context.gl;
    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const program = painter.useProgram('terrain');

    for (const tileID of sourceCache.getRenderableTileIds(painter.transform)) {
        const tile = sourceCache.getTileByID(tileID.key);
        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tile.fbo.colorAttachment.get());
        const posMatrix = painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped());
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW,
            terrainUniformValues(posMatrix), "terrain",
            sourceCache.mesh.vertexBuffer, sourceCache.mesh.indexBuffer, sourceCache.mesh.segments,
            null, null, null, tile.elevationVertexBuffer);
    }
}

function prepareTerrain(painter: Painter, sourceCache: TerrainSourceCache, depth: number=1) {
   const context = painter.context;
   let fbo = 0;
   for (const tileID of sourceCache.getRenderableTileIds(painter.transform)) {
      const tile = sourceCache.getTileByID(tileID.key);
      const tileSize = tile.tileSize * 2;
      if (!tile.textures[painter.batch]) {
         tile.textures[painter.batch] = new Texture(context, {width: tileSize, height: tileSize, data: null}, context.gl.RGBA);
         tile.textures[painter.batch].bind(context.gl.LINEAR, context.gl.CLAMP_TO_EDGE);
      }
      if (!tile.elevationVertexBuffer) {
         const meshSize = sourceCache.meshSize, vertexArray = new TerrainElevationArray();
         for (let y=0; y<=meshSize; y++) for (let x=0; x<=meshSize; x++) {
             vertexArray.emplaceBack(sourceCache.getElevation(tileID, x, y, meshSize));
         }
         tile.elevationVertexBuffer = context.createVertexBuffer(vertexArray, elevationAttributes.members, true);
      }
      if (!tile.coordsTexture) {
         tile.coordsTexture = new Texture(context, tile.coords, context.gl.RGBA, {premultiply: false});
         tile.coordsTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
      }
      // reuse a framebuffer from the framebuffer-stack and attach active batch-texture
      if (!FBOs[tileSize]) FBOs[tileSize] = {};
      if (!FBOs[tileSize][fbo]) {
         FBOs[tileSize][fbo] = context.createFramebuffer(tileSize, tileSize, true);
         FBOs[tileSize][fbo].depthAttachment.set(context.createRenderbuffer(context.gl.DEPTH_COMPONENT16, tileSize, tileSize));
      }
      tile.fbo = FBOs[tileSize][fbo++];
      tile.fbo.colorAttachment.set(tile.textures[painter.batch].texture);
      context.bindFramebuffer.set(null);
   }
}

function clearTerrain(painter: Painter, sourceCache: TerrainSourceCache, depth: number=1) {
   const context = painter.context;
   for (const tileID of sourceCache.getRenderableTileIds(painter.transform)) {
      const tile = sourceCache.getTileByID(tileID.key);
      context.bindFramebuffer.set(tile.fbo.framebuffer);
      context.clear({ color: Color.transparent, depth: depth });
      painter.finishFramebuffer();
   }
}

export {
   clearTerrain,
   prepareTerrain,
   drawTerrain,
   drawTerrainCoords
};

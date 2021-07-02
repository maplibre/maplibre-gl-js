// @flow

import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import SegmentVector from '../data/segment';
import {terrainUniformValues} from './program/terrain_program';
import type Painter from './painter';
import type TerranSourceCache from '../source/terrain_source_cache';
import CullFaceMode from '../gl/cull_face_mode';
import pos3DAttributes from '../data/pos3d_attributes';
import Texture from './texture';
import Color from '../style-spec/util/color';
import ColorMode from '../gl/color_mode';
import browser from '../util/browser';
import {Pos3DArray, TriangleIndexArray} from '../data/array_types';
import EXTENT from '../data/extent';

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
          terrainUniformValues(posMatrix), "terrain", tile.vertexBuffer, tile.indexBuffer, tile.segments);
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
            terrainUniformValues(posMatrix), "terrain", tile.vertexBuffer, tile.indexBuffer, tile.segments);
    }
}

function prepareTerrain(painter: Painter, sourceCache: TerrainSourceCache, depth: number=1) {
   const context = painter.context;
   for (const tileID of sourceCache.getRenderableTileIds(painter.transform)) {
      const tile = sourceCache.getTileByID(tileID.key);
      const tileSize = tile.tileSize * 2;
      if (!tile.textures[painter.batch]) {
         tile.textures[painter.batch] = new Texture(context, {width: tileSize, height: tileSize, data: null}, context.gl.RGBA);
         tile.textures[painter.batch].bind(context.gl.LINEAR, context.gl.CLAMP_TO_EDGE);
      }
      if (!tile.fbo) {
         tile.fbo = context.createFramebuffer(tileSize, tileSize, true);
         tile.fbo.depthAttachment.set(context.createRenderbuffer(context.gl.DEPTH_COMPONENT16, tileSize, tileSize));
      }
      if (!tile.segments) {
         const vertexArray = new Pos3DArray(), indexArray = new TriangleIndexArray();
         // create regular terrain-mesh.
         const meshSize = sourceCache.meshSize, delta = EXTENT / meshSize, meshSize2 = meshSize * meshSize;
         for (let y=0; y<=meshSize; y++) for (let x=0; x<=meshSize; x++)
            vertexArray.emplaceBack(x * delta, y * delta, Math.floor(sourceCache.getElevation(tileID, x, y, meshSize)));
         for (let y=0; y<meshSize2; y+=meshSize+1) for (let x=0; x<meshSize; x++) {
            indexArray.emplaceBack(x+y, meshSize+x+y+1, meshSize+x+y+2);
            indexArray.emplaceBack(x+y, meshSize+x+y+2, x+y+1);
         }
         tile.indexBuffer = context.createIndexBuffer(indexArray);
         tile.vertexBuffer = context.createVertexBuffer(vertexArray, pos3DAttributes.members);
         tile.segments = SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length);
      }
      if (!tile.coordsTexture) {
         tile.coordsTexture = new Texture(context, tile.coords, context.gl.RGBA, {premultiply: false});
         tile.coordsTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
      }
      // set current batch-texture to framebuffer
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

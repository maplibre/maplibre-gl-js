import {DepthMode} from '../depth_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {ColorMode} from '../color_mode.ts';
import {fogUniformValues} from '../program/fog_program.ts';
import {isRenderedToTexture} from '../render_to_texture.ts';
import {calculateFogBlendOpacity} from '../../style/sky.ts';
import {getCameraMath} from '../../camera/camera_math_factory.ts';

import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {StyleLayer} from '../../style/style_layer.ts';
import type {Terrain} from '../../render/terrain.ts';

/**
 * How much of the fog {@link drawFog} draws over the terrain. It is 0 without terrain, on the globe, when the sky
 * has no fog, or when the pitch keeps the horizon out of view.
 */
export function getTerrainFogOpacity(frameRenderContext: FrameRenderContext): number {
    const {sky, isRenderingGlobe} = frameRenderContext.data;
    if (!frameRenderContext.terrain || isRenderingGlobe || !sky || sky['fog-ground-blend'] >= 1) return 0;
    return calculateFogBlendOpacity(frameRenderContext.projectedCamera.pitch);
}

/**
 * Returns the index in `layerIds` of the last visible draped layer at `zoom`, or -1 when none is draped.
 */
export function getLastDrapedLayerIndex(layerIds: readonly string[], layers: Record<string, StyleLayer>, zoom: number): number {
    for (let i = layerIds.length - 1; i >= 0; i--) {
        const layer = layers[layerIds[i]];
        if (isRenderedToTexture(layer) && !layer.isHidden(zoom)) return i;
    }
    return -1;
}

/**
 * Draws the fog over the terrain meshes once, reading the depth buffer written by the terrain drapes and using a
 * stencil pass so overlapping tile edges are fogged only once.
 */
export function drawFog(terrain: Terrain, opacity: number, frameRenderContext: FrameRenderContext): void {
    const {sky} = frameRenderContext.data;
    const context = frameRenderContext.context;
    const gl = context.gl;
    const projectedCamera = frameRenderContext.projectedCamera;
    const program = frameRenderContext.useProgram('fog');
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, frameRenderContext.depthRangeFor3D);
    const stencilMode = frameRenderContext.stencilModeFor3D();
    const eleDelta = terrain.getSkirtLength(projectedCamera.zoom);
    const cameraMath = getCameraMath(projectedCamera);

    for (const tile of terrain.tileManager.getRenderableTiles()) {
        const mesh = terrain.getTerrainMesh(tile.tileID, false);
        const terrainData = terrain.getTerrainData(tile.tileID);
        const fogMatrix = cameraMath.calculateFogMatrix(projectedCamera, tile.tileID.toUnwrapped());
        const uniformValues = fogUniformValues(eleDelta, fogMatrix, sky, opacity);
        const projectionData = frameRenderContext.getProjectionDataForTile(tile.tileID, {applyTerrainMatrix: false});
        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, ColorMode.alphaBlended, CullFaceMode.backCCW,
            uniformValues, terrainData, projectionData, 'fog', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}

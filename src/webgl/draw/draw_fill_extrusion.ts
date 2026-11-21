import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {ColorMode} from '../color_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues,
} from '../program/fill_extrusion_program.ts';
import {updatePatternPositionsInProgram} from '../../render/update_pattern_positions_in_program.ts';
import {translatePosition} from '../../util/util.ts';

import type {OpacityRange} from '../program/fill_extrusion_program.ts';
import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import type {FillExtrusionBucket} from '../../data/bucket/fill_extrusion_bucket.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

const ANY_OPACITY: OpacityRange = [0, 2];
const FULL_OPACITY: OpacityRange = [1, 2];
const PARTIAL_OPACITY: OpacityRange = [0, 1];

/**
 * Draws a fill-extrusion layer.
 * When `fill-extrusion-opacity` varies by feature, the extrusions at 1 are drawn first and those below 1 after them,
 * so the ones at 1 show through the others.
 */
export function drawFillExtrusion(tileManager: TileManager, layer: FillExtrusionStyleLayer, coords: OverscaledTileID[], frameRenderContext: FrameRenderContext): void {
    const layerOpacity = layer.paint.get('fill-extrusion-layer-opacity');
    const opacity = layer.paint.get('fill-extrusion-opacity').constantOr(undefined);
    if (layerOpacity === 0 || opacity === 0) {
        return;
    }

    if (frameRenderContext.currentPass === 'translucent') {
        const opaque = layerOpacity === 1 && !layer.paint.get('fill-extrusion-pattern').constantOr(1 as any);

        if (opacity === undefined) {
            drawExtrusionGroup(tileManager, layer, coords, FULL_OPACITY, opaque, frameRenderContext);
            drawExtrusionGroup(tileManager, layer, coords, PARTIAL_OPACITY, false, frameRenderContext);
        } else {
            drawExtrusionGroup(tileManager, layer, coords, ANY_OPACITY, opaque && opacity === 1, frameRenderContext);
        }
    }
}

/**
 * Draws the extrusions whose opacity is in `opacityRange`.
 * With `opaque` they are drawn in one pass. Otherwise they are drawn in two passes, so that only the closest surface is drawn.
 * The first pass writes only the depth buffer. The second colors the fragments with the same depth as the closest one,
 * and uses the stencil buffer to skip coincident polygons.
 */
function drawExtrusionGroup(
    tileManager: TileManager,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    opacityRange: OpacityRange,
    opaque: boolean,
    frameRenderContext: FrameRenderContext) {
    const depthMode = new DepthMode(frameRenderContext.context.gl.LEQUAL, DepthMode.ReadWrite, frameRenderContext.depthRangeFor3D);

    if (opaque) {
        const colorMode = frameRenderContext.colorModeForRenderPass();
        drawExtrusionTiles(tileManager, layer, coords, depthMode, StencilMode.disabled, colorMode, opacityRange, frameRenderContext);

    } else {
        drawExtrusionTiles(tileManager, layer, coords, depthMode,
            StencilMode.disabled,
            ColorMode.disabled, opacityRange, frameRenderContext);

        drawExtrusionTiles(tileManager, layer, coords, depthMode,
            frameRenderContext.stencilModeFor3D(),
            frameRenderContext.colorModeForRenderPass(), opacityRange, frameRenderContext);
    }
}

function drawExtrusionTiles(
    tileManager: TileManager,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    depthMode: DepthMode,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    opacityRange: OpacityRange,
    frameRenderContext: FrameRenderContext) {
    const context = frameRenderContext.context;
    const gl = context.gl;
    const fillPropertyName = 'fill-extrusion-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const image = patternProperty.constantOr(1 as any);
    const crossfade = layer.getCrossfadeParameters();
    const layerOpacity = layer.paint.get('fill-extrusion-layer-opacity');
    const constantPattern = patternProperty.constantOr(null);
    const projectedCamera = frameRenderContext.projectedCamera;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket: FillExtrusionBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const terrainData = frameRenderContext.getTerrainDataForTile(coord);
        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = frameRenderContext.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration);

        if (image) {
            context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePaintBuffers(crossfade);
        }

        const projectionData = frameRenderContext.getProjectionDataForTile(coord);
        updatePatternPositionsInProgram(programConfiguration, fillPropertyName, constantPattern, tile, layer);

        const translate = translatePosition(
            projectedCamera,
            tile,
            layer.paint.get('fill-extrusion-translate'),
            layer.paint.get('fill-extrusion-translate-anchor')
        );

        const shouldUseVerticalGradient = layer.paint.get('fill-extrusion-vertical-gradient');
        const uniformValues = image ?
            fillExtrusionPatternUniformValues(projectedCamera, frameRenderContext.data.light, shouldUseVerticalGradient, layerOpacity, opacityRange, translate, coord, crossfade, tile) :
            fillExtrusionUniformValues(projectedCamera, frameRenderContext.data.light, shouldUseVerticalGradient, layerOpacity, opacityRange, translate);

        program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, terrainData, projectionData, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            bucket.segments, layer.paint, frameRenderContext.projectedCamera.zoom,
            programConfiguration, frameRenderContext.terrain && bucket.centroidVertexBuffer);
    }
}

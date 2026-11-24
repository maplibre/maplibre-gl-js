import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {ColorMode} from '../color_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues,
    fillExtrusionGroundOcclusionUniformValues,
} from '../program/fill_extrusion_program.ts';
import {updatePatternPositionsInProgram} from '../../render/update_pattern_positions_in_program.ts';
import {translatePosition} from '../../util/util.ts';
import {isFillExtrusionStyleLayer, type FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';

import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {Painter, RTTObject} from '../../render/painter.ts';
import type {Style} from '../../style/style.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {FillExtrusionBucket} from '../../data/bucket/fill_extrusion_bucket.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

/** Shader defines that switch on wall ambient occlusion. */
const WALL_AMBIENT_OCCLUSION_DEFINES = ['#define WALL_AMBIENT_OCCLUSION'];

/** Shader defines for the ground occlusion composite pass. */
const GROUND_OCCLUSION_COMPOSITE_DEFINES = ['#define COMPOSITE'];

/**
 * Draws a fill-extrusion layer.
 * Extrusions at a constant opacity of 1 without a pattern are drawn in one pass. Otherwise they are drawn in two passes, so that only the closest surface is drawn.
 * The first pass writes only the depth buffer. The second colors the fragments with the same depth as the closest one,
 * and uses the stencil buffer to skip coincident polygons.
 */
export function drawFillExtrusion(tileManager: TileManager, layer: FillExtrusionStyleLayer, coords: OverscaledTileID[], frameRenderContext: FrameRenderContext): void {
    const opacity = layer.paint.get('fill-extrusion-opacity');
    if (opacity.constantOr(1) === 0) {
        return;
    }

    if (frameRenderContext.currentPass === 'translucent') {
        const depthMode = new DepthMode(frameRenderContext.context.gl.LEQUAL, DepthMode.ReadWrite, frameRenderContext.depthRangeFor3D);

        if (opacity.constantOr(0) === 1 && !layer.paint.get('fill-extrusion-pattern').constantOr(1 as any)) {
            const colorMode = frameRenderContext.colorModeForRenderPass();
            drawExtrusionTiles(tileManager, layer, coords, depthMode, StencilMode.disabled, colorMode, frameRenderContext);

        } else {
            drawExtrusionTiles(tileManager, layer, coords, depthMode,
                StencilMode.disabled,
                ColorMode.disabled, frameRenderContext);

            drawExtrusionTiles(tileManager, layer, coords, depthMode,
                frameRenderContext.stencilModeFor3D(),
                frameRenderContext.colorModeForRenderPass(), frameRenderContext);
        }
    }
}

/** Sizes the painter's ground occlusion FBO, clears it, and enables `MAX` blending. */
function beginGroundOcclusionPass(painter: Painter, width: number, height: number): void {
    const context = painter.context;
    const gl = context.gl;
    let fbo = painter.groundOcclusionFbo;

    if (fbo?.width !== width || fbo?.height !== height) {
        fbo?.destroy();
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, width, height);
        fbo = painter.groundOcclusionFbo = context.createFramebuffer(width, height, false, false);
        fbo.colorAttachment.set(texture);
    }
    context.bindFramebuffer.set(fbo.framebuffer);
    context.viewport.set([0, 0, width, height]);
    context.clear({color: Color.transparent});
    context.blendEquation.set(gl.MAX);
}

function drawGroundOcclusionLayer(
    tileManager: TileManager,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    composite: boolean,
    depthMode: Readonly<DepthMode>,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    frameRenderContext: FrameRenderContext): void {
    const {context, projectedCamera} = frameRenderContext;
    const gl = context.gl;
    const intensity = layer.paint.get('fill-extrusion-ambient-occlusion-ground-intensity');
    const radius = layer.paint.get('fill-extrusion-ambient-occlusion-ground-radius');
    const translate = layer.paint.get('fill-extrusion-translate');
    const translateAnchor = layer.paint.get('fill-extrusion-translate-anchor');
    const vertexArrayKey = composite ? `${layer.id}$ground-occlusion-composite` : `${layer.id}$ground-occlusion`;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket: FillExtrusionBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = frameRenderContext.useProgram('fillExtrusionGroundOcclusion', programConfiguration, false, composite ? GROUND_OCCLUSION_COMPOSITE_DEFINES : undefined);
        const tileTranslate = translatePosition(projectedCamera, tile, translate, translateAnchor);
        const uniformValues = fillExtrusionGroundOcclusionUniformValues(intensity, radius, tileTranslate, coord.canonical);

        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, null, frameRenderContext.getProjectionDataForTile(coord),
            vertexArrayKey, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments, layer.paint, projectedCamera.zoom, programConfiguration);
    }
}

/**
 * Darkens the ground along the walls of all `fill-extrusion` layers by the strongest strip at each pixel:
 * `MAX`-blended into an offscreen `R8` texture in the offscreen pass, then depth- and stencil-tested in the translucent pass.
 */
export function drawFillExtrusionGroundOcclusion(
    painter: Painter,
    style: Style,
    coordsDescending: Readonly<Record<string, OverscaledTileID[]>>,
    frameRenderContext: FrameRenderContext): void {
    if (frameRenderContext.terrain || frameRenderContext.data.isRenderingGlobe) return;

    const {context, projectedCamera} = frameRenderContext;
    const gl = context.gl;
    const composite = frameRenderContext.currentPass === 'translucent';
    let depthMode: Readonly<DepthMode> = DepthMode.disabled;
    let stencilMode: Readonly<StencilMode> = StencilMode.disabled;
    let colorMode: Readonly<ColorMode> = ColorMode.plusLighter;
    let started = false;

    for (const layerId of style._order) {
        const layer = style._layers[layerId];
        if (!isFillExtrusionStyleLayer(layer) || layer.isHidden(projectedCamera.zoom) || !layer.hasGroundOcclusion()) continue;

        if (!started) {
            started = true;
            if (composite) {
                context.activeTexture.set(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, painter.groundOcclusionFbo.colorAttachment.get());
                depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, frameRenderContext.depthRangeFor3D);
                stencilMode = frameRenderContext.stencilModeFor3D();
                colorMode = frameRenderContext.colorModeForRenderPass();
            } else {
                beginGroundOcclusionPass(painter, painter.width, painter.height);
            }
        }

        drawGroundOcclusionLayer(style.tileManagers[layer.source], layer, coordsDescending[layer.source],
            composite, depthMode, stencilMode, colorMode, frameRenderContext);
    }

    if (composite) return;
    if (started) {
        context.blendEquation.set(gl.FUNC_ADD);
        return;
    }
    painter.groundOcclusionFbo?.destroy();
    painter.groundOcclusionFbo = null;
}

/** Drapes the ground occlusion of `layerIds` into a terrain tile's RTT texture via the shared `R8` texture. */
export function drawFillExtrusionGroundOcclusionToTexture(
    painter: Painter,
    style: Style,
    layerIds: string[],
    coordsBySource: Readonly<Record<string, Record<string, OverscaledTileID[]>>>,
    tileKey: string,
    target: RTTObject,
    frameRenderContext: FrameRenderContext): void {
    const context = frameRenderContext.context;
    const gl = context.gl;
    let started = false;

    for (const layerId of layerIds) {
        const layer = style._layers[layerId] as FillExtrusionStyleLayer;
        const coords = coordsBySource[layer.source]?.[tileKey];
        if (!coords?.length) continue;

        if (!started) {
            started = true;
            // Mesa 24.3 to 25.3.1 on Intel Gen12 (#9003): flush before re-clearing an FBO sampled earlier in the frame.
            if (frameRenderContext.groundOcclusionSampled) {
                gl.flush();
            }
            beginGroundOcclusionPass(painter, target.size, target.size);
        }

        drawGroundOcclusionLayer(style.tileManagers[layer.source], layer, coords,
            false, DepthMode.disabled, StencilMode.disabled, ColorMode.plusLighter, frameRenderContext);
    }

    if (!started) return;

    context.blendEquation.set(gl.FUNC_ADD);
    painter.bindRTT(target);
    context.viewport.set([0, 0, target.size, target.size]);
    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, painter.groundOcclusionFbo.colorAttachment.get());

    const stencilMode = frameRenderContext.stencilModeFor3D();
    const colorMode = frameRenderContext.colorModeForRenderPass();
    for (const layerId of layerIds) {
        const layer = style._layers[layerId] as FillExtrusionStyleLayer;
        const coords = coordsBySource[layer.source]?.[tileKey];
        if (!coords?.length) continue;

        drawGroundOcclusionLayer(style.tileManagers[layer.source], layer, coords,
            true, DepthMode.disabled, stencilMode, colorMode, frameRenderContext);
    }

    frameRenderContext.groundOcclusionSampled = true;
}

function drawExtrusionTiles(
    tileManager: TileManager,
    layer: FillExtrusionStyleLayer,
    coords: OverscaledTileID[],
    depthMode: DepthMode,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>,
    frameRenderContext: FrameRenderContext) {
    const context = frameRenderContext.context;
    const gl = context.gl;
    const fillPropertyName = 'fill-extrusion-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const image = patternProperty.constantOr(1 as any);
    const crossfade = layer.getCrossfadeParameters();
    const constantPattern = patternProperty.constantOr(null);
    const projectedCamera = frameRenderContext.projectedCamera;
    const aoWallIntensity = layer.paint.get('fill-extrusion-ambient-occlusion-wall-intensity');
    const aoWallRadius = layer.paint.get('fill-extrusion-ambient-occlusion-wall-radius');
    const defines = aoWallIntensity > 0 && aoWallRadius > 0 ? WALL_AMBIENT_OCCLUSION_DEFINES : undefined;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket: FillExtrusionBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const terrainData = frameRenderContext.getTerrainDataForTile(coord);
        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = frameRenderContext.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration, false, defines);

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
            fillExtrusionPatternUniformValues(projectedCamera, frameRenderContext.data.light, shouldUseVerticalGradient, translate, aoWallIntensity, aoWallRadius, coord, crossfade, tile) :
            fillExtrusionUniformValues(projectedCamera, frameRenderContext.data.light, shouldUseVerticalGradient, translate, aoWallIntensity, aoWallRadius);

        program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, terrainData, projectionData, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            bucket.segments, layer.paint, frameRenderContext.projectedCamera.zoom,
            programConfiguration, frameRenderContext.terrain && bucket.centroidVertexBuffer);
    }
}

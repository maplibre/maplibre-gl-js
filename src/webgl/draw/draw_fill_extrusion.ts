import {mat4} from 'gl-matrix';
import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {ColorMode} from '../color_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues,
    fillExtrusionGroundOcclusionUniformValues,
    fillExtrusionGroundOcclusionCompositeUniformValues,
} from '../program/fill_extrusion_program.ts';
import {updatePatternPositionsInProgram} from '../../render/update_pattern_positions_in_program.ts';
import {translatePosition} from '../../util/util.ts';
import {isFillExtrusionStyleLayer, type FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import {getCameraMath} from '../../camera/camera_math_factory.ts';
import {EXTENT} from '../../data/extent.ts';

import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {Painter, RTTObject} from '../../render/painter.ts';
import type {Style} from '../../style/style.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {FillExtrusionBucket} from '../../data/bucket/fill_extrusion_bucket.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';
import type {RendererProjectionData} from '../../geo/projection/projection_data.ts';

/** Shader defines that switch on wall ambient occlusion. */
const WALL_AMBIENT_OCCLUSION_DEFINES = ['#define WALL_AMBIENT_OCCLUSION'];

/** Shader defines for the ground occlusion composite pass. */
const GROUND_OCCLUSION_COMPOSITE_DEFINES = ['#define COMPOSITE'];
const compositeWorldQuad = new Float64Array(16);
let mercatorCompositeProjection: RendererProjectionData | null = null;
let rttCompositeProjection: RendererProjectionData | null = null;

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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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
    tuckWorldPixels: number,
    frameRenderContext: FrameRenderContext): boolean {
    const {context, projectedCamera} = frameRenderContext;
    const gl = context.gl;
    const intensity = layer.paint.get('fill-extrusion-ambient-occlusion-ground-intensity');
    const radius = layer.paint.get('fill-extrusion-ambient-occlusion-ground-radius');
    const translate = layer.paint.get('fill-extrusion-translate');
    const translateAnchor = layer.paint.get('fill-extrusion-translate-anchor');
    const vertexArrayKey = `${layer.id}$ground-occlusion`;
    let drewAny = false;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket: FillExtrusionBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;
        if (bucket.wallSegments?.get().length === 0) continue;
        const segments = bucket.wallSegments ?? bucket.segments;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = frameRenderContext.useProgram('fillExtrusionGroundOcclusion', programConfiguration);
        const tileTranslate = translatePosition(projectedCamera, tile, translate, translateAnchor);
        const tuckTileUnits = tuckWorldPixels > 0 ? tuckWorldPixels * EXTENT * Math.pow(2, coord.canonical.z) / projectedCamera.worldSize : 0;
        const uniformValues = fillExtrusionGroundOcclusionUniformValues(intensity, radius, tuckTileUnits, tileTranslate, coord.canonical);

        program.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.plusLighter, CullFaceMode.disabled,
            uniformValues, null, frameRenderContext.getProjectionDataForTile(coord),
            vertexArrayKey, bucket.layoutVertexBuffer, bucket.indexBuffer, segments, layer.paint, projectedCamera.zoom, programConfiguration);
        drewAny = true;
    }
    return drewAny;
}

/**
 * Darkens the ground along the walls of all `fill-extrusion` layers by the strongest strip at each pixel:
 * `MAX`-blended into a half-resolution `R8` texture in the offscreen pass, then bilinearly composited with a depth-tested ground quad.
 */
export function drawFillExtrusionGroundOcclusion(
    painter: Painter,
    style: Style,
    coordsDescending: Readonly<Record<string, OverscaledTileID[]>>,
    frameRenderContext: FrameRenderContext): void {
    if (frameRenderContext.terrain || frameRenderContext.data.isRenderingGlobe) return;

    const {context, projectedCamera} = frameRenderContext;
    const gl = context.gl;

    if (frameRenderContext.currentPass === 'translucent') {
        if (!frameRenderContext.groundOcclusionReady || !painter.groundOcclusionFbo) return;
        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, painter.groundOcclusionFbo.colorAttachment.get());
        const depthMode = new DepthMode(gl.LESS, DepthMode.ReadOnly, frameRenderContext.depthRangeFor3D);
        const uniformValues = fillExtrusionGroundOcclusionCompositeUniformValues(1 / painter.width, 1 / painter.height);
        frameRenderContext.useProgram('fillExtrusionGroundOcclusion', null, false, GROUND_OCCLUSION_COMPOSITE_DEFINES).draw(
            context, gl.TRIANGLES, depthMode, StencilMode.disabled, frameRenderContext.colorModeForRenderPass(),
            CullFaceMode.disabled, uniformValues, null, mercatorCompositeProjection,
            'groundOcclusionComposite', painter.viewportBuffer, painter.quadTriangleIndexBuffer, painter.viewportSegments);
        return;
    }

    let started = false;
    let minWorldX = Infinity;
    let minWorldY = Infinity;
    let maxWorldX = -Infinity;
    let maxWorldY = -Infinity;
    const tuckWorldPixels = (2.5 / Math.max(1, frameRenderContext.data.pixelRatio)) / Math.max(0.25, Math.cos(projectedCamera.pitchInRadians));

    for (const layerId of style._order) {
        const layer = style._layers[layerId];
        if (!isFillExtrusionStyleLayer(layer) || layer.isHidden(projectedCamera.zoom) || !layer.hasGroundOcclusion()) continue;
        const coords = coordsDescending[layer.source];
        if (!coords?.length) continue;

        if (!started) {
            started = true;
            beginGroundOcclusionPass(painter, Math.max(1, (painter.width + 1) >> 1), Math.max(1, (painter.height + 1) >> 1));
        }

        if (!drawGroundOcclusionLayer(style.tileManagers[layer.source], layer, coords, tuckWorldPixels, frameRenderContext)) continue;

        const radiusMargin = layer.paint.get('fill-extrusion-ambient-occlusion-ground-radius') * projectedCamera.pixelsPerMeter;
        for (const coord of coords) {
            const tile = style.tileManagers[layer.source].getTile(coord);
            if (!tile.getBucket(layer)) continue;
            const scale = Math.pow(2, coord.canonical.z);
            const tileSize = projectedCamera.worldSize / scale;
            const tileX = (coord.canonical.x + coord.wrap * scale) * tileSize;
            const tileY = coord.canonical.y * tileSize;
            const pad = radiusMargin + tileSize * (1024 / EXTENT);
            if (tileX - pad < minWorldX) minWorldX = tileX - pad;
            if (tileY - pad < minWorldY) minWorldY = tileY - pad;
            if (tileX + tileSize + pad > maxWorldX) maxWorldX = tileX + tileSize + pad;
            if (tileY + tileSize + pad > maxWorldY) maxWorldY = tileY + tileSize + pad;
        }
    }

    if (!started) {
        painter.groundOcclusionFbo?.destroy();
        painter.groundOcclusionFbo = null;
        return;
    }

    context.blendEquation.set(gl.FUNC_ADD);
    if (minWorldX >= maxWorldX) return;

    if (!mercatorCompositeProjection) {
        mercatorCompositeProjection = getCameraMath(projectedCamera).getProjectionData(projectedCamera, {overscaledTileID: null});
        mercatorCompositeProjection.uniformBufferKey = 'groundOcclusionComposite';
    }
    mat4.set(compositeWorldQuad,
        maxWorldX - minWorldX, 0, 0, 0,
        0, maxWorldY - minWorldY, 0, 0,
        0, 0, 1, 0,
        minWorldX, minWorldY, 0, 1);
    mat4.multiply(mercatorCompositeProjection.mainMatrix, projectedCamera.modelViewProjectionMatrix, compositeWorldQuad);
    frameRenderContext.groundOcclusionReady = true;
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
    let drewAny = false;

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

        if (drawGroundOcclusionLayer(style.tileManagers[layer.source], layer, coords, 0, frameRenderContext)) {
            drewAny = true;
        }
    }

    if (!started) return;

    context.blendEquation.set(gl.FUNC_ADD);
    if (!drewAny) return;

    painter.bindRTT(target);
    context.viewport.set([0, 0, target.size, target.size]);
    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, painter.groundOcclusionFbo.colorAttachment.get());

    if (!rttCompositeProjection) {
        rttCompositeProjection = getCameraMath(frameRenderContext.projectedCamera).getProjectionData(frameRenderContext.projectedCamera, {overscaledTileID: null});
        rttCompositeProjection.uniformBufferKey = 'groundOcclusionRTT';
        mat4.set(rttCompositeProjection.mainMatrix,
            2, 0, 0, 0,
            0, 2, 0, 0,
            0, 0, 1, 0,
            -1, -1, 0, 1);
    }

    const uniformValues = fillExtrusionGroundOcclusionCompositeUniformValues(1 / target.size, 1 / target.size);
    frameRenderContext.useProgram('fillExtrusionGroundOcclusion', null, false, GROUND_OCCLUSION_COMPOSITE_DEFINES).draw(
        context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, frameRenderContext.colorModeForRenderPass(),
        CullFaceMode.disabled, uniformValues, null, rttCompositeProjection,
        'groundOcclusionRTT', painter.viewportBuffer, painter.quadTriangleIndexBuffer, painter.viewportSegments);

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

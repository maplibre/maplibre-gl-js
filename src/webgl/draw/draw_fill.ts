import {Color} from '@maplibre/maplibre-gl-style-spec';
import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {type ColorMode} from '../color_mode.ts';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
} from '../program/fill_program.ts';
import {lineTextureUniformValues} from '../program/line_program.ts';

import type {Painter, RenderOptions} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import type {FillBucket} from '../../data/bucket/fill_bucket.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';
import type {Context} from '../context.ts';
import type {Framebuffer} from '../framebuffer.ts';
import {updatePatternPositionsInProgram} from '../../render/update_pattern_positions_in_program.ts';
import {translatePosition} from '../../util/util.ts';

export function drawFill(painter: Painter, tileManager: TileManager, layer: FillStyleLayer, coords: OverscaledTileID[], renderOptions: RenderOptions) {
    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');

    if (opacity.constantOr(1) === 0) {
        return;
    }

    const useOffscreen = layer.hasOffscreenPass() && !painter.style.map.terrain;

    if (!useOffscreen && layer.fillFbo) {
        layer.fillFbo.destroy();
        layer.fillFbo = null;
    }

    if (useOffscreen) {
        if (painter.renderPass === 'offscreen') {
            drawFillOffscreen(painter, tileManager, layer, coords, renderOptions);
        } else if (painter.renderPass === 'translucent') {
            drawFillComposite(painter, layer);
        }
        return;
    }

    const {isRenderingToTexture} = renderOptions;
    const colorMode = painter.colorModeForRenderPass();
    const pattern = layer.paint.get('fill-pattern');
    const pass = painter.opaquePassEnabledForLayer() &&
        (!pattern.constantOr(1 as any) &&
            color.constantOr(Color.transparent).a === 1 &&
            opacity.constantOr(0) === 1) ? 'opaque' : 'translucent';

    // Draw fill
    if (painter.renderPass === pass) {
        const depthMode = painter.getDepthModeForSublayer(
            1, painter.renderPass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
        drawFillTiles(painter, tileManager, layer, coords, depthMode, colorMode, false, isRenderingToTexture);
    }

    // Draw stroke
    if (painter.renderPass === 'translucent' && layer.paint.get('fill-antialias')) {
        const depthMode = painter.getDepthModeForSublayer(
            layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
        drawFillTiles(painter, tileManager, layer, coords, depthMode, colorMode, true, isRenderingToTexture);
    }
}

function drawFillOffscreen(painter: Painter, tileManager: TileManager, layer: FillStyleLayer, coords: OverscaledTileID[], renderOptions: RenderOptions) {
    const context = painter.context;

    layer.fillFbo ??= createFillFbo(context, painter.width, painter.height);

    context.bindFramebuffer.set(layer.fillFbo.framebuffer);
    context.viewport.set([0, 0, painter.width, painter.height]);
    context.clear({color: Color.transparent, depth: 1, stencil: 0});

    painter.currentStencilSource = undefined;
    painter._renderTileClippingMasks(layer, coords, false);

    const {isRenderingToTexture} = renderOptions;
    const colorMode = painter.colorModeForRenderPass();

    // Draw fill
    const depthMode = painter.getDepthModeForSublayer(1, DepthMode.ReadOnly);
    drawFillTiles(painter, tileManager, layer, coords, depthMode, colorMode, false, isRenderingToTexture);

    // Draw stroke
    if (layer.paint.get('fill-antialias')) {
        const outlineDepthMode = painter.getDepthModeForSublayer(
            layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
        drawFillTiles(painter, tileManager, layer, coords, outlineDepthMode, colorMode, true, isRenderingToTexture);
    }
}

function drawFillComposite(painter: Painter, layer: FillStyleLayer) {
    const fbo = layer.fillFbo;
    if (!fbo) return;

    const context = painter.context;
    const gl = context.gl;

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    const opacity = layer.paint.get('layer-opacity' as any) as number;
    painter.useProgram('lineTexture').draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        lineTextureUniformValues(painter, opacity, 0), null, null,
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}

function drawFillTiles(
    painter: Painter,
    tileManager: TileManager,
    layer: FillStyleLayer,
    coords: OverscaledTileID[],
    depthMode: Readonly<DepthMode>,
    colorMode: Readonly<ColorMode>,
    isOutline: boolean,
    isRenderingToTexture: boolean) {
    const gl = painter.context.gl;
    const fillPropertyName = 'fill-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const image = patternProperty?.constantOr(1 as any);
    const crossfade = layer.getCrossfadeParameters();
    let drawMode, programName, uniformValues, indexBuffer, segments;

    const transform = painter.transform;

    const propertyFillTranslate = layer.paint.get('fill-translate');
    const propertyFillTranslateAnchor = layer.paint.get('fill-translate-anchor');

    if (!isOutline) {
        programName = image ? 'fillPattern' : 'fill';
        drawMode = gl.TRIANGLES;
    } else {
        programName = image && !layer.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline';
        drawMode = gl.LINES;
    }

    const constantPattern = patternProperty.constantOr(null);

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;

        const bucket: FillBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram(programName, programConfiguration);
        const terrainData = painter.style.map.terrain?.getTerrainData(coord);

        if (image) {
            painter.context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePaintBuffers(crossfade);
        }

        updatePatternPositionsInProgram(programConfiguration, fillPropertyName, constantPattern, tile, layer);

        const projectionData = transform.getProjectionData({
            overscaledTileID: coord,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        const translateForUniforms = translatePosition(transform, tile, propertyFillTranslate, propertyFillTranslateAnchor);

        if (!isOutline) {
            indexBuffer = bucket.indexBuffer;
            segments = bucket.segments;
            uniformValues = image ? fillPatternUniformValues(painter, crossfade, tile, translateForUniforms) : fillUniformValues(translateForUniforms);
        } else {
            indexBuffer = bucket.indexBuffer2;
            segments = bucket.segments2;
            const drawingBufferSize = [gl.drawingBufferWidth, gl.drawingBufferHeight] as [number, number];
            uniformValues = (programName === 'fillOutlinePattern' && image) ?
                fillOutlinePatternUniformValues(painter, crossfade, tile, drawingBufferSize, translateForUniforms) :
                fillOutlineUniformValues(drawingBufferSize, translateForUniforms);
        }

        const stencil = painter.stencilModeForClipping(coord);

        program.draw(painter.context, drawMode, depthMode,
            stencil, colorMode, CullFaceMode.backCCW, uniformValues, terrainData, projectionData,
            layer.id, bucket.layoutVertexBuffer, indexBuffer, segments,
            layer.paint, painter.transform.zoom, programConfiguration);
    }
}

function createFillFbo(context: Context, width: number, height: number): Framebuffer {
    const gl = context.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const fbo = context.createFramebuffer(width, height, true, true);
    fbo.colorAttachment.set(texture);
    fbo.depthAttachment.set(context.createRenderbuffer(gl.DEPTH_STENCIL, width, height));

    return fbo;
}

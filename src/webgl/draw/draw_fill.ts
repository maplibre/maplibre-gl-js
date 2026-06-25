import {Color} from '@maplibre/maplibre-gl-style-spec';
import {DepthMode} from '../depth_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
} from '../program/fill_program.ts';
import {updatePatternPositionsInProgram} from '../../render/update_pattern_positions_in_program.ts';
import {translatePosition} from '../../util/util.ts';
import {drawLayerOpacity, prepareDrawLayerOpacity} from './draw_layer_opacity.ts';

import type {ColorMode} from '../color_mode.ts';
import type {Painter, RenderOptions} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import type {FillBucket} from '../../data/bucket/fill_bucket.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

export function drawFill(painter: Painter, tileManager: TileManager, layer: FillStyleLayer, coords: OverscaledTileID[], renderOptions: RenderOptions): void {
    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');
    const layerOpacity = layer.paint.get('fill-layer-opacity');
    if (opacity.constantOr(1) === 0 || layerOpacity === 0) return;

    if (layerOpacity < 1) {
        if (painter.renderPass !== 'translucent') return;
        const useTerrain = !!painter.style.map.terrain;

        const results = prepareDrawLayerOpacity(painter,layer, coords, useTerrain);
        drawFillAndOutline(painter, tileManager, layer, coords, renderOptions);
        drawLayerOpacity(painter, layerOpacity, results, layer);
        return;
    }

    const pattern = layer.paint.get('fill-pattern');
    const fillEligibleForOpaque = painter.opaquePassEnabledForLayer() &&
        !pattern.constantOr(1 as any) &&
        color.constantOr(Color.transparent).a === 1 &&
        opacity.constantOr(0) === 1;

    if (fillEligibleForOpaque && painter.renderPass === 'opaque') {
        // Opaque-eligible fill draws standalone in the opaque pass with ReadWrite depth;
        // its outline (always translucent) runs in the translucent pass below.
        const {isRenderingToTexture} = renderOptions;
        const colorMode = painter.colorModeForRenderPass();
        const depthMode = painter.getDepthModeForSublayer(1, DepthMode.ReadWrite);
        drawFillTiles(painter, tileManager, layer, coords, depthMode, colorMode, false, isRenderingToTexture);
        return;
    }
    if (fillEligibleForOpaque && painter.renderPass === 'translucent') {
        // Fill already drew in the opaque pass; just draw the outline here.
        drawOutline(painter, tileManager, layer, coords, renderOptions);
        return;
    }
    if (painter.renderPass === 'translucent') {
        drawFillAndOutline(painter, tileManager, layer, coords, renderOptions);
    }
}

/**
 * Draw fill + outline in a single translucent pass with ReadOnly depth.
 * Shared by the layer-opacity subpass (always) and the normal translucent path
 * (when the fill is not opaque-pass-eligible).
 */
function drawFillAndOutline(
    painter: Painter,
    tileManager: TileManager,
    layer: FillStyleLayer,
    coords: OverscaledTileID[],
    renderOptions: RenderOptions
) {
    const {isRenderingToTexture} = renderOptions;
    const colorMode = painter.colorModeForRenderPass();

    const fillDepthMode = painter.getDepthModeForSublayer(1, DepthMode.ReadOnly);
    drawFillTiles(painter, tileManager, layer, coords, fillDepthMode, colorMode, false, isRenderingToTexture);

    drawOutline(painter, tileManager, layer, coords, renderOptions);
}

function drawOutline(
    painter: Painter,
    tileManager: TileManager,
    layer: FillStyleLayer,
    coords: OverscaledTileID[],
    renderOptions: RenderOptions
) {
    if (!layer.paint.get('fill-antialias')) return;

    // If we defined a different color for the fill outline, we are
    // going to ignore the bits in 0x07 and just care about the global
    // clipping mask.
    // Otherwise, we only want to drawFill the antialiased parts that are
    // *outside* the current shape. This is important in case the fill
    // or stroke color is translucent. If we wouldn't clip to outside
    // the current shape, some pixels from the outline stroke overlapped
    // the (non-antialiased) fill.
    const {isRenderingToTexture} = renderOptions;
    const colorMode = painter.colorModeForRenderPass();
    const depthMode = painter.getDepthModeForSublayer(
        layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
    drawFillTiles(painter, tileManager, layer, coords, depthMode, colorMode, true, isRenderingToTexture);
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
        const terrainData = painter.getTerrainDataForTile(coord, isRenderingToTexture);

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

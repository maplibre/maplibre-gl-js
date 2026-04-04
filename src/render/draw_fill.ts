import {Color} from '@maplibre/maplibre-gl-style-spec';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {type ColorMode} from '../gl/color_mode';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
} from './program/fill_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {FillStyleLayer} from '../style/style_layer/fill_style_layer';
import type {FillBucket} from '../data/bucket/fill_bucket';
import type {OverscaledTileID} from '../tile/tile_id';
import {updatePatternPositionsInProgram} from './update_pattern_positions_in_program';
import {translatePosition} from '../util/util';

// Drawable imports
import {DrawableBuilder} from './drawable/drawable_builder';
import {TileLayerGroup} from './drawable/tile_layer_group';
import {FillLayerTweaker} from './drawable/tweakers/fill_layer_tweaker';

export function drawFill(painter: Painter, tileManager: TileManager, layer: FillStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');

    if (opacity.constantOr(1) === 0) {
        return;
    }

    // Use drawable path if enabled
    if (painter.useDrawables && painter.useDrawables.has('fill')) {
        drawFillDrawable(painter, tileManager, layer, coords, renderOptions);
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

        // If we defined a different color for the fill outline, we are
        // going to ignore the bits in 0x07 and just care about the global
        // clipping mask.
        // Otherwise, we only want to drawFill the antialiased parts that are
        // *outside* the current shape. This is important in case the fill
        // or stroke color is translucent. If we wouldn't clip to outside
        // the current shape, some pixels from the outline stroke overlapped
        // the (non-antialiased) fill.
        const depthMode = painter.getDepthModeForSublayer(
            layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
        drawFillTiles(painter, tileManager, layer, coords, depthMode, colorMode, true, isRenderingToTexture);
    }
}

function drawFillTiles(
    painter: Painter,
    tileManager: TileManager,
    layer: FillStyleLayer,
    coords: Array<OverscaledTileID>,
    depthMode: Readonly<DepthMode>,
    colorMode: Readonly<ColorMode>,
    isOutline: boolean,
    isRenderingToTexture: boolean) {
    const gl = painter.context.gl;
    const fillPropertyName = 'fill-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const image = patternProperty && patternProperty.constantOr(1 as any);
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
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

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
            stencil, colorMode, CullFaceMode.backCCW, uniformValues as any, terrainData as any, projectionData as any,
            layer.id, bucket.layoutVertexBuffer, indexBuffer, segments,
            layer.paint, painter.transform.zoom, programConfiguration);
    }
}

/**
 * Drawable-based rendering path for fills.
 * Creates drawables for both fill triangles and outline lines per tile.
 */
function drawFillDrawable(painter: Painter, tileManager: TileManager, layer: FillStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');
    const colorMode = painter.colorModeForRenderPass();
    const pattern = layer.paint.get('fill-pattern');
    const image = pattern && pattern.constantOr(1 as any);
    const crossfade = layer.getCrossfadeParameters();

    const pass = painter.opaquePassEnabledForLayer() &&
        (!pattern.constantOr(1 as any) &&
            color.constantOr(Color.transparent).a === 1 &&
            opacity.constantOr(0) === 1) ? 'opaque' : 'translucent';

    // Get or create tweaker
    let tweaker = painter.layerTweakers.get(layer.id) as FillLayerTweaker;
    if (!tweaker) {
        tweaker = new FillLayerTweaker(layer.id);
        painter.layerTweakers.set(layer.id, tweaker);
    }

    // Get or create layer group
    let layerGroup = painter.layerGroups.get(layer.id);
    if (!layerGroup) {
        layerGroup = new TileLayerGroup(layer.id);
        painter.layerGroups.set(layer.id, layerGroup);
    }

    const propertyFillTranslate = layer.paint.get('fill-translate');
    const propertyFillTranslateAnchor = layer.paint.get('fill-translate-anchor');
    const fillPropertyName = 'fill-pattern';
    const patternProperty = layer.paint.get(fillPropertyName);
    const constantPattern = patternProperty.constantOr(null);

    const visibleTileKeys = new Set<string>();

    // Always rebuild drawables to match per-frame stencil state.
    // Stencil refs from _renderTileClippingMasks can change each frame as tiles reorder.
    // Don't call destroy() — GPU may still reference old buffers; let GC handle them.
    const isWebGPU = painter.device?.type === 'webgpu';
    (layerGroup as any)._drawablesByTile.clear();

    for (const coord of coords) {
        visibleTileKeys.add(coord.key.toString());

        const tile = tileManager.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;

        const bucket: FillBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

        if (image) {
            context.activeTexture.set(gl.TEXTURE0);
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
        // In WebGPU mode, stencil clipping is handled by _drawWebGPU via setStencilReference
        const stencil = isWebGPU ? null : painter.stencilModeForClipping(coord);

        // Draw fill triangles
        // When rendering to texture (terrain), draw regardless of pass since RTT skips the opaque pass
        if (painter.renderPass === pass || isRenderingToTexture) {
            const depthMode = painter.getDepthModeForSublayer(
                1, painter.renderPass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
            const programName = image ? 'fillPattern' : 'fill';
            // Skip WebGL program creation in WebGPU mode (would fail and log noise)
            const program = isWebGPU ? null : painter.useProgram(programName, programConfiguration);
            const uniformValues = image ?
                fillPatternUniformValues(painter, crossfade, tile, translateForUniforms) :
                fillUniformValues(translateForUniforms);

            const fillBuilder = new DrawableBuilder()
                .setShader(programName)
                .setRenderPass(pass as 'opaque' | 'translucent')
                .setDepthMode(depthMode)
                .setStencilMode(stencil)
                .setColorMode(colorMode)
                .setCullFaceMode(CullFaceMode.backCCW)
                .setLayerTweaker(tweaker);

            const fillDrawable = fillBuilder.flush({
                tileID: coord,
                layer,
                program,
                programConfiguration,
                layoutVertexBuffer: bucket.layoutVertexBuffer,
                indexBuffer: bucket.indexBuffer,
                segments: bucket.segments,
                projectionData,
                terrainData: terrainData || null,
                paintProperties: layer.paint,
                zoom: painter.transform.zoom,
            });
            fillDrawable.uniformValues = uniformValues as any;
            layerGroup.addDrawable(coord, fillDrawable);
        }

        // Draw outline
        if (painter.renderPass === 'translucent' && layer.paint.get('fill-antialias')) {
            const depthMode = painter.getDepthModeForSublayer(
                layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
            const outlineProgramName = image && !layer.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline';
            const outlineProgram = painter.useProgram(outlineProgramName, programConfiguration);

            const drawingBufferSize = [gl.drawingBufferWidth, gl.drawingBufferHeight] as [number, number];
            const outlineUniformValues = (outlineProgramName === 'fillOutlinePattern' && image) ?
                fillOutlinePatternUniformValues(painter, crossfade, tile, drawingBufferSize, translateForUniforms) :
                fillOutlineUniformValues(drawingBufferSize, translateForUniforms);

            const outlineBuilder = new DrawableBuilder()
                .setShader(outlineProgramName)
                .setRenderPass('translucent')
                .setDepthMode(depthMode)
                .setStencilMode(stencil)
                .setColorMode(colorMode)
                .setCullFaceMode(CullFaceMode.backCCW)
                .setDrawMode(1) // gl.LINES = 1
                .setLayerTweaker(tweaker);

            const outlineDrawable = outlineBuilder.flush({
                tileID: coord,
                layer,
                program: outlineProgram,
                programConfiguration,
                layoutVertexBuffer: bucket.layoutVertexBuffer,
                indexBuffer: bucket.indexBuffer2,
                segments: bucket.segments2,
                projectionData,
                terrainData: terrainData || null,
                paintProperties: layer.paint,
                zoom: painter.transform.zoom,
            });
            outlineDrawable.uniformValues = outlineUniformValues as any;
            layerGroup.addDrawable(coord, outlineDrawable);
        }
    }

    // Remove stale tiles
    layerGroup.removeDrawablesIf(d => d.tileID !== null && !visibleTileKeys.has(d.tileID.key.toString()));

    // Run tweaker
    const allDrawables = layerGroup.getAllDrawables();
    tweaker.execute(allDrawables, painter, layer, coords);

    // Draw
    for (const drawable of allDrawables) {
        drawable.draw(context, painter.device, painter, renderOptions.renderPass);
    }
}

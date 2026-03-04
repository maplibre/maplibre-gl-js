import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {Texture} from './texture';
import {
    lineUniformValues,
    linePatternUniformValues,
    lineSDFUniformValues,
    lineGradientUniformValues,
    lineGradientSDFUniformValues
} from './program/line_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {LineStyleLayer} from '../style/style_layer/line_style_layer';
import type {LineBucket} from '../data/bucket/line_bucket';
import type {OverscaledTileID} from '../tile/tile_id';
import type {Tile} from '../tile/tile';
import type {Context} from '../gl/context';
import type {ProgramConfiguration} from '../data/program_configuration';
import {LumaModel} from './luma_model';
import {clamp, nextPowerOfTwo} from '../util/util';
import {renderColorRamp} from '../util/color_ramp';
import {EXTENT} from '../data/extent';
import type {RGBAImage} from '../util/image';

// Drawable imports
import {DrawableBuilder} from './drawable/drawable_builder';
import {TileLayerGroup} from './drawable/tile_layer_group';
import {LineLayerTweaker} from './drawable/tweakers/line_layer_tweaker';

type GradientTexture = {
    texture?: Texture;
    gradient?: RGBAImage;
    version?: number;
};

function updateGradientTexture(
    painter: Painter,
    tileManager: TileManager,
    context: Context,
    gl: WebGLRenderingContext,
    layer: LineStyleLayer,
    bucket: LineBucket,
    coord: OverscaledTileID,
    layerGradient: GradientTexture
): Texture {
    let textureResolution = 256;
    if (layer.stepInterpolant) {
        const sourceMaxZoom = tileManager.getSource().maxzoom;
        const potentialOverzoom = coord.canonical.z === sourceMaxZoom ?
            Math.ceil(1 << (painter.transform.maxZoom - coord.canonical.z)) : 1;
        const lineLength = bucket.maxLineLength / EXTENT;
        // Logical pixel tile size is 512px, and 1024px right before current zoom + 1
        const maxTilePixelSize = 1024;
        // Maximum possible texture coverage heuristic, bound by hardware max texture size
        const maxTextureCoverage = lineLength * maxTilePixelSize * potentialOverzoom;
        textureResolution = clamp(nextPowerOfTwo(maxTextureCoverage), 256, context.maxTextureSize);
    }
    layerGradient.gradient = renderColorRamp({
        expression: layer.gradientExpression(),
        evaluationKey: 'lineProgress',
        resolution: textureResolution,
        image: layerGradient.gradient || undefined,
        clips: bucket.lineClipsArray
    });
    if (layerGradient.texture) {
        layerGradient.texture.update(layerGradient.gradient);
    } else {
        layerGradient.texture = new Texture(context, layerGradient.gradient, gl.RGBA);
    }
    layerGradient.version = layer.gradientVersion;
    return layerGradient.texture;
}

function bindImagePatternTextures(
    context: Context,
    gl: WebGLRenderingContext,
    tile: Tile,
    programConfiguration: ProgramConfiguration,
    crossfade: ReturnType<LineStyleLayer['getCrossfadeParameters']>
) {
    context.activeTexture.set(gl.TEXTURE0);
    tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    programConfiguration.updatePaintBuffers(crossfade);
}

function bindDasharrayTextures(
    painter: Painter,
    context: Context,
    gl: WebGLRenderingContext,
    programConfiguration: ProgramConfiguration,
    programChanged: boolean,
    crossfade: ReturnType<LineStyleLayer['getCrossfadeParameters']>
) {
    if (programChanged || painter.lineAtlas.dirty) {
        context.activeTexture.set(gl.TEXTURE0);
        painter.lineAtlas.bind(context);
    }
    programConfiguration.updatePaintBuffers(crossfade);
}

function bindGradientTextures(
    painter: Painter,
    tileManager: TileManager,
    context: Context,
    gl: WebGLRenderingContext,
    layer: LineStyleLayer,
    bucket: LineBucket,
    coord: OverscaledTileID
) {
    const layerGradient = bucket.gradients[layer.id];
    let gradientTexture = layerGradient.texture;
    if (layer.gradientVersion !== layerGradient.version) {
        gradientTexture = updateGradientTexture(painter, tileManager, context, gl, layer, bucket, coord, layerGradient);
    }
    context.activeTexture.set(gl.TEXTURE0);
    gradientTexture.bind(layer.stepInterpolant ? gl.NEAREST : gl.LINEAR, gl.CLAMP_TO_EDGE);
}

function bindGradientAndDashTextures(
    painter: Painter,
    tileManager: TileManager,
    context: Context,
    gl: WebGLRenderingContext,
    layer: LineStyleLayer,
    bucket: LineBucket,
    coord: OverscaledTileID,
    programConfiguration: ProgramConfiguration,
    crossfade: ReturnType<LineStyleLayer['getCrossfadeParameters']>
) {
    // Bind gradient texture to TEXTURE0
    const layerGradient = bucket.gradients[layer.id];
    let gradientTexture = layerGradient.texture;
    if (layer.gradientVersion !== layerGradient.version) {
        gradientTexture = updateGradientTexture(painter, tileManager, context, gl, layer, bucket, coord, layerGradient);
    }
    context.activeTexture.set(gl.TEXTURE0);
    gradientTexture.bind(layer.stepInterpolant ? gl.NEAREST : gl.LINEAR, gl.CLAMP_TO_EDGE);

    // Bind dash atlas to TEXTURE1
    context.activeTexture.set(gl.TEXTURE1);
    painter.lineAtlas.bind(context);

    programConfiguration.updatePaintBuffers(crossfade);
}

export function drawLine(painter: Painter, tileManager: TileManager, layer: LineStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (painter.renderPass !== 'translucent') return;

    const {isRenderingToTexture} = renderOptions;

    const opacity = layer.paint.get('line-opacity');
    const width = layer.paint.get('line-width');
    if (opacity.constantOr(1) === 0 || width.constantOr(1) === 0) return;

    // Use drawable path if enabled
    if (painter.useDrawables && painter.useDrawables.has('line')) {
        drawLineDrawable(painter, tileManager, layer, coords, renderOptions);
        return;
    }

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    const dasharrayProperty = layer.paint.get('line-dasharray');
    const dasharray = dasharrayProperty.constantOr(1 as any);
    const patternProperty = layer.paint.get('line-pattern');
    const image = patternProperty.constantOr(1 as any);

    const gradient = layer.paint.get('line-gradient');
    const crossfade = layer.getCrossfadeParameters();

    let programId: string;
    if (image) programId = 'linePattern';
    else if (dasharray && gradient) programId = 'lineGradientSDF';
    else if (dasharray) programId = 'lineSDF';
    else if (gradient) programId = 'lineGradient';
    else programId = 'line';

    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    let firstTile = true;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);

        if (image && !tile.patternsLoaded()) continue;

        const bucket: LineBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const prevProgram = painter.context.program.get();
        const program = painter.useProgram(programId, programConfiguration);
        const programChanged = firstTile || program.program !== prevProgram;
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

        const constantPattern = patternProperty.constantOr(null);
        const constantDasharray = dasharrayProperty && dasharrayProperty.constantOr(null);

        if (constantPattern && tile.imageAtlas) {
            const atlas = tile.imageAtlas;
            const posTo = atlas.patternPositions[constantPattern.to.toString()];
            const posFrom = atlas.patternPositions[constantPattern.from.toString()];
            if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);

        } else if (constantDasharray) {
            const round = layer.layout.get('line-cap') === 'round';
            const dashTo = painter.lineAtlas.getDash(constantDasharray.to, round);
            const dashFrom = painter.lineAtlas.getDash(constantDasharray.from, round);
            programConfiguration.setConstantDashPositions(dashTo, dashFrom);
        }

        const projectionData = transform.getProjectionData({
            overscaledTileID: coord,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        const pixelRatio = transform.getPixelScale();

        let uniformValues;
        if (image) {
            uniformValues = linePatternUniformValues(painter, tile, layer, pixelRatio, crossfade);
            bindImagePatternTextures(context, gl, tile, programConfiguration, crossfade);
        } else if (dasharray && gradient) {
            uniformValues = lineGradientSDFUniformValues(painter, tile, layer, pixelRatio, crossfade, bucket.lineClipsArray.length);
            bindGradientAndDashTextures(painter, tileManager, context, gl, layer, bucket, coord, programConfiguration, crossfade);
        } else if (dasharray) {
            uniformValues = lineSDFUniformValues(painter, tile, layer, pixelRatio, crossfade);
            bindDasharrayTextures(painter, context, gl, programConfiguration, programChanged, crossfade);
        } else if (gradient) {
            uniformValues = lineGradientUniformValues(painter, tile, layer, pixelRatio, bucket.lineClipsArray.length);
            bindGradientTextures(painter, tileManager, context, gl, layer, bucket, coord);
        } else {
            uniformValues = lineUniformValues(painter, tile, layer, pixelRatio);
        }

        const stencil = painter.stencilModeForClipping(coord);

        const lumaModel = new LumaModel(
            painter.device,
            program,
            bucket.layoutVertexBuffer,
            bucket.indexBuffer,
            bucket.segments
        );

        lumaModel.draw(context, gl.TRIANGLES, depthMode,
            stencil, colorMode, CullFaceMode.disabled, uniformValues as any, terrainData as any, projectionData as any,
            layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments,
            layer.paint, painter.transform.zoom, programConfiguration, bucket.layoutVertexBuffer2);

        firstTile = false;
        // once refactored so that bound texture state is managed, we'll also be able to remove this firstTile/programChanged logic
    }
}

/**
 * Drawable-based rendering path for lines.
 */
function drawLineDrawable(painter: Painter, tileManager: TileManager, layer: LineStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    const dasharrayProperty = layer.paint.get('line-dasharray');
    const dasharray = dasharrayProperty.constantOr(1 as any);
    const patternProperty = layer.paint.get('line-pattern');
    const image = patternProperty.constantOr(1 as any);
    const gradient = layer.paint.get('line-gradient');
    const crossfade = layer.getCrossfadeParameters();

    let programId: string;
    if (image) programId = 'linePattern';
    else if (dasharray && gradient) programId = 'lineGradientSDF';
    else if (dasharray) programId = 'lineSDF';
    else if (gradient) programId = 'lineGradient';
    else programId = 'line';

    // Get or create tweaker
    let tweaker = painter.layerTweakers.get(layer.id) as LineLayerTweaker;
    if (!tweaker) {
        tweaker = new LineLayerTweaker(layer.id);
        painter.layerTweakers.set(layer.id, tweaker);
    }

    // Get or create layer group
    let layerGroup = painter.layerGroups.get(layer.id);
    if (!layerGroup) {
        layerGroup = new TileLayerGroup(layer.id);
        painter.layerGroups.set(layer.id, layerGroup);
    }

    const visibleTileKeys = new Set<string>();
    let firstTile = true;

    for (const coord of coords) {
        visibleTileKeys.add(coord.key.toString());

        // Reuse existing drawable if tile already has one (avoids GPU buffer churn)
        if (layerGroup.hasDrawablesForTile(coord)) {
            continue;
        }

        const tile = tileManager.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;

        const bucket: LineBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const isWebGPU = painter.device?.type === 'webgpu';
        const prevProgram = context.program.get();
        const program = isWebGPU ? null : painter.useProgram(programId, programConfiguration);
        const programChanged = firstTile || (program && program.program !== prevProgram);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

        const constantPattern = patternProperty.constantOr(null);
        const constantDasharray = dasharrayProperty && dasharrayProperty.constantOr(null);

        if (constantPattern && tile.imageAtlas) {
            const atlas = tile.imageAtlas;
            const posTo = atlas.patternPositions[constantPattern.to.toString()];
            const posFrom = atlas.patternPositions[constantPattern.from.toString()];
            if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);
        } else if (constantDasharray) {
            const round = layer.layout.get('line-cap') === 'round';
            const dashTo = painter.lineAtlas.getDash(constantDasharray.to, round);
            const dashFrom = painter.lineAtlas.getDash(constantDasharray.from, round);
            programConfiguration.setConstantDashPositions(dashTo, dashFrom);
        }

        const projectionData = transform.getProjectionData({
            overscaledTileID: coord,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        const pixelRatio = transform.getPixelScale();

        // Compute uniform values and bind textures (same as legacy path)
        let uniformValues;
        if (image) {
            uniformValues = linePatternUniformValues(painter, tile, layer, pixelRatio, crossfade);
            bindImagePatternTextures(context, gl, tile, programConfiguration, crossfade);
        } else if (dasharray && gradient) {
            uniformValues = lineGradientSDFUniformValues(painter, tile, layer, pixelRatio, crossfade, bucket.lineClipsArray.length);
            bindGradientAndDashTextures(painter, tileManager, context, gl, layer, bucket, coord, programConfiguration, crossfade);
        } else if (dasharray) {
            uniformValues = lineSDFUniformValues(painter, tile, layer, pixelRatio, crossfade);
            bindDasharrayTextures(painter, context, gl, programConfiguration, programChanged, crossfade);
        } else if (gradient) {
            uniformValues = lineGradientUniformValues(painter, tile, layer, pixelRatio, bucket.lineClipsArray.length);
            bindGradientTextures(painter, tileManager, context, gl, layer, bucket, coord);
        } else {
            uniformValues = lineUniformValues(painter, tile, layer, pixelRatio);
        }

        // In WebGPU mode, stencil clipping is handled by _drawWebGPU via setStencilReference
        const stencil = isWebGPU ? null : painter.stencilModeForClipping(coord);

        const lineBuilder = new DrawableBuilder()
            .setShader(programId)
            .setRenderPass('translucent')
            .setDepthMode(depthMode)
            .setStencilMode(stencil)
            .setColorMode(colorMode)
            .setCullFaceMode(CullFaceMode.disabled)
            .setLayerTweaker(tweaker);

        const drawable = lineBuilder.flush({
            tileID: coord,
            layer,
            program,
            programConfiguration,
            layoutVertexBuffer: bucket.layoutVertexBuffer,
            indexBuffer: bucket.indexBuffer,
            segments: bucket.segments,
            dynamicLayoutBuffer: bucket.layoutVertexBuffer2,
            projectionData,
            terrainData: terrainData || null,
            paintProperties: layer.paint,
            zoom: painter.transform.zoom,
        });
        drawable.uniformValues = uniformValues as any;
        layerGroup.addDrawable(coord, drawable);

        firstTile = false;
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

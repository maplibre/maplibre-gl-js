// WebGPU drawable path for line layers.
// Extracted from src/render/draw_line.ts

import {DepthMode} from '../../gl/depth_mode';
import {CullFaceMode} from '../../gl/cull_face_mode';
import {
    lineUniformValues,
    linePatternUniformValues,
    lineSDFUniformValues,
    lineGradientUniformValues,
    lineGradientSDFUniformValues
} from '../../render/program/line_program';
import {DrawableBuilder} from '../../gfx/drawable_builder';
import {TileLayerGroup} from '../../gfx/tile_layer_group';
import {LineLayerTweaker} from '../../gfx/tweakers/line_layer_tweaker';

import type {Painter, RenderOptions} from '../../render/painter';
import type {TileManager} from '../../tile/tile_manager';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer';
import type {LineBucket} from '../../data/bucket/line_bucket';
import type {OverscaledTileID} from '../../tile/tile_id';

/**
 * Drawable-based rendering path for lines.
 */
export function drawLineWebGPU(painter: Painter, tileManager: TileManager, layer: LineStyleLayer, coords: Array<OverscaledTileID>, renderOptions: RenderOptions) {
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

    // Always rebuild drawables to match per-frame stencil state.
    // Stencil refs from _renderTileClippingMasks can change each frame as tiles reorder.
    (layerGroup as any)._drawablesByTile.clear();

    for (const coord of coords) {
        visibleTileKeys.add(coord.key.toString());

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
            const round = (layer.layout.get('line-cap') as any) === 'round';
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

        // Store texture references for re-binding during draw
        if (gradient) {
            const layerGradient = bucket.gradients[layer.id];
            const gradTex = layerGradient.texture;
            if (gradTex) {
                const gradEntry: any = {
                    name: 'u_image',
                    textureUnit: 0,
                    texture: gradTex.texture,
                    filter: layer.stepInterpolant ? gl.NEAREST : gl.LINEAR,
                    wrap: gl.CLAMP_TO_EDGE
                };
                // Add raw pixel data for WebGPU texture creation
                const gradImg = layerGradient.gradient;
                if (gradImg?.data) {
                    gradEntry.source = {
                        data: gradImg.data,
                        width: gradImg.width,
                        height: gradImg.height,
                        bytesPerPixel: 4,
                        format: 'rgba8unorm'
                    };
                }
                lineBuilder.addTexture(gradEntry);
            }
        }
        if (dasharray) {
            const dashTex: any = {
                name: 'u_dash_image',
                textureUnit: gradient ? 1 : 0,
                texture: painter.lineAtlas.texture,
                filter: gl.LINEAR,
                wrap: gl.REPEAT
            };
            // Store source data for WebGPU texture creation
            // Line atlas uses ALPHA format (1 byte/pixel) — WebGPU uses r8unorm
            dashTex.source = {
                data: painter.lineAtlas.data,
                width: painter.lineAtlas.width,
                height: painter.lineAtlas.height,
                bytesPerPixel: 1,
                format: 'r8unorm'
            };
            lineBuilder.addTexture(dashTex);
        }
        if (image && tile.imageAtlasTexture) {
            const patternTex: any = {
                name: 'pattern_texture',
                textureUnit: 0,
                texture: tile.imageAtlasTexture.texture,
                filter: gl.LINEAR,
                wrap: gl.CLAMP_TO_EDGE,
            };
            // WebGPU needs raw source data to create a texture
            if (isWebGPU && tile.imageAtlas?.image?.data) {
                patternTex.source = {
                    data: tile.imageAtlas.image.data,
                    width: tile.imageAtlas.image.width,
                    height: tile.imageAtlas.image.height,
                    bytesPerPixel: 4,
                    format: 'rgba8unorm',
                };
            }
            lineBuilder.addTexture(patternTex);
        }

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

        // Store per-tile pattern data for WebGPU linePattern tweaker
        if (image && isWebGPU && tile.imageAtlas) {
            const atlas = tile.imageAtlas;
            const patternImage = patternProperty.constantOr(null);
            if (patternImage) {
                const posFrom = atlas.patternPositions[patternImage.from.toString()];
                const posTo = atlas.patternPositions[patternImage.to.toString()];
                const atlasTex = tile.imageAtlasTexture;
                if (posFrom && posTo && atlasTex) {
                    (drawable as any)._patternData = {
                        patternFrom: posFrom,
                        patternTo: posTo,
                        texsize: atlasTex.size,
                    };
                }
            }
        }

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

// Helper functions copied from draw_line.ts (used only by the drawable path's texture binding)

import type {Context} from '../../gl/context';
import type {Tile} from '../../tile/tile';
import type {ProgramConfiguration} from '../../data/program_configuration';
import {Texture} from '../../render/texture';
import {clamp, nextPowerOfTwo} from '../../util/util';
import {renderColorRamp} from '../../util/color_ramp';
import {EXTENT} from '../../data/extent';
import type {RGBAImage} from '../../util/image';

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

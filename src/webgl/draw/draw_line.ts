import {Color} from '@maplibre/maplibre-gl-style-spec';
import {DepthMode} from '../depth_mode';
import {StencilMode} from '../stencil_mode';
import {CullFaceMode} from '../cull_face_mode';
import {Texture} from '../texture';
import {
    lineUniformValues,
    linePatternUniformValues,
    lineSDFUniformValues,
    lineGradientUniformValues,
    lineGradientSDFUniformValues,
    lineTextureUniformValues
} from '../program/line_program';

import type {Painter, RenderOptions} from '../../render/painter';
import type {TileManager} from '../../tile/tile_manager';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer';
import type {LineBucket} from '../../data/bucket/line_bucket';
import type {OverscaledTileID} from '../../tile/tile_id';
import type {Tile} from '../../tile/tile';
import type {Context} from '../context';
import type {Framebuffer} from '../framebuffer';
import type {ProgramConfiguration} from '../../data/program_configuration';
import {clamp, nextPowerOfTwo} from '../../util/util';
import {renderColorRamp} from '../../util/color_ramp';
import {EXTENT} from '../../data/extent';
import type {RGBAImage} from '../../util/image';

const FULL_OPACITY = {constantOr: () => 1.0};

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

export function drawLine(painter: Painter, tileManager: TileManager, layer: LineStyleLayer, coords: OverscaledTileID[], renderOptions: RenderOptions) {
    if (painter.renderPass !== 'offscreen' && painter.renderPass !== 'translucent') return;

    const opacity = layer.paint.get('line-opacity');
    const width = layer.paint.get('line-width');
    if (opacity.constantOr(1) === 0 || width.constantOr(1) === 0) return;

    const constantOpacity = opacity.constantOr(-1);
    const useOffscreen = constantOpacity > 0 && constantOpacity < 1 && !painter.style.map.terrain;

    // Free FBO when offscreen path is no longer needed
    if (!useOffscreen && layer.lineFbo) {
        layer.lineFbo.destroy();
        layer.lineFbo = null;
    }

    // if the opacity is not constant (full/tansparent), we need to render to an offscreen FBO at full opacity and the 
    // composite pass will apply the opacity.
    // If we do this any other way, there will be really ugly artifacts
    if (useOffscreen) {
        if (painter.renderPass === 'offscreen') {
            drawLineOffscreen(painter, tileManager, layer, coords, renderOptions);
        } else {
            drawLineComposite(painter, layer);
        }
    } else if (painter.renderPass === 'translucent') {
        drawLineTiles(painter, tileManager, layer, coords, renderOptions, layer.paint, true);
    }
}

function drawLineOffscreen(painter: Painter, tileManager: TileManager, layer: LineStyleLayer, coords: OverscaledTileID[], renderOptions: RenderOptions) {
    const context = painter.context;

    if (!layer.lineFbo) {
        layer.lineFbo = createLineFbo(context, painter.width, painter.height);
    }

    context.bindFramebuffer.set(layer.lineFbo.framebuffer);
    context.viewport.set([0, 0, painter.width, painter.height]);
    context.clear({color: Color.transparent, depth: 1, stencil: 0});

    // Force stencil masks to render into the FBO
    painter.currentStencilSource = undefined;
    painter._renderTileClippingMasks(layer, coords, false);

    const paintOverride = {
        get(property: string) {
            if (property === 'line-opacity') return FULL_OPACITY;
            return layer.paint.get(property as any);
        }
    };

    drawLineTiles(painter, tileManager, layer, coords, renderOptions, paintOverride, false);
}

function drawLineComposite(painter: Painter, layer: LineStyleLayer) {
    const fbo = layer.lineFbo;
    if (!fbo) return;

    const context = painter.context;
    const gl = context.gl;

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    painter.useProgram('lineTexture').draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        lineTextureUniformValues(painter, layer, 0), null, null,
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}

function drawLineTiles(
    painter: Painter,
    tileManager: TileManager,
    layer: LineStyleLayer,
    coords: OverscaledTileID[],
    renderOptions: RenderOptions,
    paint: any,
    useTerrain: boolean
) {
    const {isRenderingToTexture} = renderOptions;

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
        const terrainData = useTerrain ? painter.style.map.terrain?.getTerrainData(coord) : null;

        const constantPattern = patternProperty.constantOr(null);
        const constantDasharray = dasharrayProperty?.constantOr(null);

        if (constantPattern && tile.imageAtlas) {
            const atlas = tile.imageAtlas;
            const posTo = atlas.patternPositions[constantPattern.to.toString()];
            const posFrom = atlas.patternPositions[constantPattern.from.toString()];
            if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);
        } else if (constantDasharray) {
            const round = layer.layout.get('line-cap').constantOr(null) === 'round';
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

        program.draw(context, gl.TRIANGLES, depthMode,
            stencil, colorMode, CullFaceMode.disabled, uniformValues, terrainData, projectionData,
            layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments,
            paint, painter.transform.zoom, programConfiguration, bucket.layoutVertexBuffer2);

        firstTile = false;
        // once refactored so that bound texture state is managed, we'll also be able to remove this firstTile/programChanged logic
    }
}

function createLineFbo(context: Context, width: number, height: number): Framebuffer {
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

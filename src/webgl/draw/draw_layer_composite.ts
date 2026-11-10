import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {ColorMode} from '../color_mode.ts';
import {layerCompositeUniformValues} from '../program/layer_composite_program.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {EXTENT} from '../../data/extent.ts';
import {isLineStyleLayer, type LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import {isFillStyleLayer, type FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import {isRasterStyleLayer, type RasterStyleLayer} from '../../style/style_layer/raster_style_layer.ts';

import type {FrameRenderContext} from '../../render/frame_render_context.ts';
import type {Painter} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {StyleLayer} from '../../style/style_layer.ts';
import type {FillPaintPropsPossiblyEvaluated} from '../../style/style_layer/fill_style_layer_properties.g.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

/** The `{line,fill}-layer-blend` values, which the style spec keeps identical for both layer types. */
type LayerBlend = FillPaintPropsPossiblyEvaluated['fill-layer-blend'];

/** Blend modes evaluated in the shader. Only these need a copy of the backdrop. */
const shaderBlendDefines = {
    multiply: ['#define LAYER_BLEND;', '#define LAYER_BLEND_MULTIPLY;'],
    overlay: ['#define LAYER_BLEND;', '#define LAYER_BLEND_OVERLAY;'],
    color: ['#define LAYER_BLEND;', '#define LAYER_BLEND_NONSEPARABLE;', '#define LAYER_BLEND_COLOR;'],
    luminosity: ['#define LAYER_BLEND;', '#define LAYER_BLEND_NONSEPARABLE;']
} satisfies Partial<Record<LayerBlend, string[]>>;

type ShaderBlend = keyof typeof shaderBlendDefines;

function isShaderBlend(blend: LayerBlend): blend is ShaderBlend {
    return blend in shaderBlendDefines;
}

/**
 * Whether the layer blends in the shader, with a copy of the backdrop.
 * The copy resolves multisampled pixels, so it takes in every layer already drawn into an antialiased edge.
 * The opaque pass draws the layers above first, so it ends below the first layer that blends in the shader.
 */
export function layerBlendsInShader(layer: StyleLayer): boolean {
    if (isFillStyleLayer(layer)) return isShaderBlend(layer.paint.get('fill-layer-blend'));
    if (isLineStyleLayer(layer)) return isShaderBlend(layer.paint.get('line-layer-blend'));
    if (isRasterStyleLayer(layer)) return isShaderBlend(layer.paint.get('raster-layer-blend'));
    return false;
}

/** Blend modes a fixed-function blend function reproduces exactly, so the GPU's own destination suffices. */
const fixedFunctionBlends: Record<Exclude<LayerBlend, ShaderBlend | 'normal'>, Readonly<ColorMode>> = {
    'plus-lighter': ColorMode.plusLighter,
    screen: ColorMode.screen
};

type PrepareDrawLayerCompositeResult = {
    compositeTarget: WebGLFramebuffer | null;
    compositeViewport: [number, number, number, number];
    bounds: [number, number, number, number];
};

const TILE_CORNERS = [
    [0, 0],
    [EXTENT, 0],
    [0, EXTENT],
    [EXTENT, EXTENT]
];

/**
 * Viewport box the layer can touch. Fill and line are both `isTileClipped()`, so the stencil mask confines
 * every drawn pixel to the projected tile quads and the corner bounding box needs no padding.
 * Falls back to the whole viewport whenever the corners do not bound the drawn area: subdivision curves the
 * tile edges, terrain draws into a tile-local RTT viewport, and a corner behind the camera projects to infinity.
 */
function getCoordsViewportBounds(coords: OverscaledTileID[], frameRenderContext: FrameRenderContext): [number, number, number, number] {
    const [, , viewportWidth, viewportHeight] = frameRenderContext.context.viewport.get();
    const wholeViewport: [number, number, number, number] = [0, 0, viewportWidth, viewportHeight];

    if (coords.length === 0) {
        return [0, 0, 0, 0];
    }
    if (frameRenderContext.terrain || frameRenderContext.data.useSubdivision) {
        return wholeViewport;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const coord of coords) {
        const unwrapped = coord.toUnwrapped();
        for (const [cx, cy] of TILE_CORNERS) {
            const {point, signedDistanceFromCamera} = frameRenderContext.transform.projectTileCoordinates(cx, cy, unwrapped, null);
            if (signedDistanceFromCamera <= 0) return wholeViewport;

            const sx = (point.x + 1) * 0.5 * viewportWidth;
            const sy = (point.y + 1) * 0.5 * viewportHeight;

            if (sx < minX) minX = sx;
            if (sx > maxX) maxX = sx;
            if (sy < minY) minY = sy;
            if (sy > maxY) maxY = sy;
        }
    }

    const x1 = Math.max(0, Math.floor(minX));
    const y1 = Math.max(0, Math.floor(minY));
    const x2 = Math.min(viewportWidth, Math.ceil(maxX));
    const y2 = Math.min(viewportHeight, Math.ceil(maxY));

    if (x2 <= x1 || y2 <= y1) {
        return [0, 0, 0, 0];
    }

    return [x1, y1, x2 - x1, y2 - y1];
}

/**
 * Partial `{line,fill}-layer-opacity` / `{line,fill}-layer-blend`:
 * render the whole layer to a scratch FBO so it composites as one surface instead of per feature.
 * The bounds only cover tiles with a bucket for the layer, since the tile draw loops skip the others.
 * A raster layer takes the whole viewport, since an image source can draw beyond its tile.
 */
export function prepareDrawLayerComposite(painter: Painter, tileManager: TileManager, layer: LineStyleLayer | FillStyleLayer | RasterStyleLayer, coords: OverscaledTileID[], frameRenderContext: FrameRenderContext): PrepareDrawLayerCompositeResult {
    const context = frameRenderContext.context;
    const compositeTarget = context.bindFramebuffer.get();
    const compositeViewport = context.viewport.get();
    const [, , width, height] = compositeViewport;

    bindLayerComposite(painter, width, height);

    context.viewport.set([0, 0, width, height]);
    context.clear({color: Color.transparent, depth: 1, stencil: 0});

    frameRenderContext.invalidateTileClippingMasks();
    frameRenderContext.renderTileClippingMasks(layer, coords);

    const drawnCoords = coords.filter((coord) => tileManager.getTile(coord)?.getBucket(layer));
    const bounds: [number, number, number, number] = isRasterStyleLayer(layer) ? [0, 0, width, height] : getCoordsViewportBounds(drawnCoords, frameRenderContext);

    return {
        compositeTarget,
        compositeViewport,
        bounds
    };
}

function bindLayerComposite(painter: Painter, width: number, height: number): void {
    const gl = painter.context.gl;

    if (!painter.layerCompositeFbo) {
        const fbo = painter.context.createFramebuffer(width, height, true, true);
        fbo.colorAttachment.set(createCompositeTexture(painter, width, height));
        fbo.depthAttachment.set(painter.context.createRenderbuffer(gl.DEPTH_STENCIL, width, height));
        painter.layerCompositeFbo = fbo;
        painter.context.bindFramebuffer.set(painter.layerCompositeFbo.framebuffer);
        return;
    }
    if (painter.layerCompositeFbo.width === width && painter.layerCompositeFbo.height === height) {
        painter.context.bindFramebuffer.set(painter.layerCompositeFbo.framebuffer);
        return;
    }
    const fbo = painter.layerCompositeFbo;
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    painter.context.bindRenderbuffer.set(fbo.depthAttachment.get());
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);
    painter.context.bindRenderbuffer.set(null);
    fbo.width = width;
    fbo.height = height;
    painter.context.bindFramebuffer.set(fbo.framebuffer);
}

/** Creates an RGBA texture and leaves it bound to the active texture unit. */
function createCompositeTexture(painter: Painter, width: number, height: number): WebGLTexture {
    const gl = painter.context.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return texture;
}

/**
 * Copies the target's scissor box into a reusable texture, since a blend mode cannot sample the framebuffer it draws into.
 * The texture only ever grows, so it can be larger than the box.
 */
function copyBackdrop(painter: Painter, x: number, y: number, width: number, height: number): void {
    const gl = painter.context.gl;
    const backdrop = painter.layerCompositeBackdrop;

    if (!backdrop) {
        painter.layerCompositeBackdrop = {texture: createCompositeTexture(painter, width, height), width, height};
    } else if (backdrop.width < width || backdrop.height < height) {
        backdrop.width = Math.max(backdrop.width, width);
        backdrop.height = Math.max(backdrop.height, height);
        gl.bindTexture(gl.TEXTURE_2D, backdrop.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, backdrop.width, backdrop.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    } else {
        gl.bindTexture(gl.TEXTURE_2D, backdrop.texture);
    }
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, x, y, width, height);
}

/**
 * Composites the layer from the scratch FBO into the target, with the layer's opacity and blend mode.
 * A blend mode evaluated in the shader has already mixed in the backdrop, so its result replaces the target.
 * With the overdraw inspector on, the scratch FBO holds the layer's overdraw count, which is added to the target's.
 */
export function drawLayerComposite(painter: Painter, opacity: number, blend: LayerBlend, prepareResult: PrepareDrawLayerCompositeResult, layer: LineStyleLayer | FillStyleLayer | RasterStyleLayer, frameRenderContext: FrameRenderContext): void {
    const context = frameRenderContext.context;
    const gl = context.gl;
    const [bx, by, bw, bh] = prepareResult.bounds;

    context.bindFramebuffer.set(prepareResult.compositeTarget);
    context.viewport.set(prepareResult.compositeViewport);
    frameRenderContext.invalidateTileClippingMasks();

    if (bw === 0 || bh === 0) return;

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(bx, by, bw, bh);

    const overdrawInspector = frameRenderContext.data.showOverdrawInspector;
    const shaderBlend = !overdrawInspector && isShaderBlend(blend) ? blend : null;

    if (shaderBlend) {
        context.activeTexture.set(gl.TEXTURE1);
        copyBackdrop(painter, bx, by, bw, bh);
    }

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, painter.layerCompositeFbo.colorAttachment.get());

    let colorMode: Readonly<ColorMode>;
    if (overdrawInspector) {
        colorMode = ColorMode.plusLighter;
    } else if (shaderBlend) {
        colorMode = ColorMode.unblended;
    } else if (blend === 'normal') {
        colorMode = frameRenderContext.colorModeForRenderPass();
    } else {
        colorMode = fixedFunctionBlends[blend];
    }
    const defines = shaderBlend ? shaderBlendDefines[shaderBlend] : [];

    frameRenderContext.useProgram('layerComposite', null, false, defines).draw(context, gl.TRIANGLES,
        frameRenderContext.getDepthModeForSublayer(0, DepthMode.ReadOnly), StencilMode.disabled, colorMode, CullFaceMode.disabled,
        layerCompositeUniformValues(opacity, 0, 1, [bx, by]), null, null,
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, frameRenderContext.transform.zoom);

    gl.disable(gl.SCISSOR_TEST);
}

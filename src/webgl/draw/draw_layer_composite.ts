import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {ColorMode} from '../color_mode.ts';
import {layerCompositeUniformValues} from '../program/layer_composite_program.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {EXTENT} from '../../data/extent.ts';

import type {Painter} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

/** The `{line,fill}-layer-blend` values. */
export type LayerBlend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'plus' | 'erase';

/** Blend modes evaluated in the shader. Only these need a copy of the backdrop. */
type ShaderBlend = 'multiply' | 'overlay';

const shaderBlendDefines = {
    multiply: ['#define LAYER_BLEND;', '#define LAYER_BLEND_MULTIPLY;'] as string[],
    overlay: ['#define LAYER_BLEND;', '#define LAYER_BLEND_OVERLAY;'] as string[]
} as const;

/** Blend modes a fixed-function blend function reproduces exactly, so the GPU's own destination suffices. */
const fixedFunctionBlends: Record<Exclude<LayerBlend, ShaderBlend | 'normal'>, Readonly<ColorMode>> = {
    plus: ColorMode.plus,
    erase: ColorMode.erase,
    screen: ColorMode.screen
};

export type PrepareDrawLayerCompositeResult = {
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
function getCoordsViewportBounds(painter: Painter, coords: OverscaledTileID[], terrain: boolean): [number, number, number, number] {
    const [, , viewportWidth, viewportHeight] = painter.context.viewport.get();
    const wholeViewport: [number, number, number, number] = [0, 0, viewportWidth, viewportHeight];

    if (coords.length === 0) {
        return [0, 0, 0, 0];
    }
    if (terrain || painter.style.projection.useSubdivision) {
        return wholeViewport;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const coord of coords) {
        const unwrapped = coord.toUnwrapped();
        for (const [cx, cy] of TILE_CORNERS) {
            const {point, signedDistanceFromCamera} = painter.transform.projectTileCoordinates(cx, cy, unwrapped, null);
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
 */
export function prepareDrawLayerComposite(painter: Painter, tileManager: TileManager, layer: LineStyleLayer | FillStyleLayer, coords: OverscaledTileID[], terrain: boolean): PrepareDrawLayerCompositeResult {
    const context = painter.context;
    const compositeTarget = context.bindFramebuffer.get();
    const compositeViewport = context.viewport.get();
    const [, , width, height] = compositeViewport;

    bindLayerComposite(painter, width, height);

    context.viewport.set([0, 0, width, height]);
    context.clear({color: Color.transparent, depth: 1, stencil: 0});

    painter.currentStencilSource = undefined;
    painter.renderTileClippingMasks(layer, coords, terrain);

    // Tiles without a bucket are skipped by the tile draw loops, so they must not widen the box either.
    const drawnCoords = coords.filter((coord) => tileManager.getTile(coord)?.getBucket(layer));
    const bounds = getCoordsViewportBounds(painter, drawnCoords, terrain);

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
 * Copies the target's scissor box into a texture, since a blend mode cannot sample the framebuffer it draws into.
 * The texture is sized to the box and only ever grown, to keep reallocations out of the frame loop.
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

export function drawLayerComposite(painter: Painter, opacity: number, blend: LayerBlend, prepareResult: PrepareDrawLayerCompositeResult, layer: LineStyleLayer | FillStyleLayer): void {
    const context = painter.context;
    const gl = context.gl;
    const [bx, by, bw, bh] = prepareResult.bounds;

    if (bw === 0 || bh === 0) return;

    context.bindFramebuffer.set(prepareResult.compositeTarget);
    context.viewport.set(prepareResult.compositeViewport);

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(bx, by, bw, bh);

    const shaderBlend: ShaderBlend | null = blend === 'multiply' || blend === 'overlay' ? blend : null;

    if (shaderBlend) {
        context.activeTexture.set(gl.TEXTURE1);
        copyBackdrop(painter, bx, by, bw, bh);
    }

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, painter.layerCompositeFbo.colorAttachment.get());

    let colorMode: Readonly<ColorMode>;
    if (shaderBlend) {
        // The shader already blended against the backdrop, so its result replaces the target.
        colorMode = painter._showOverdrawInspector ? painter.colorModeForRenderPass() : ColorMode.unblended;
    } else if (blend === 'normal') {
        colorMode = painter.colorModeForRenderPass();
    } else {
        colorMode = fixedFunctionBlends[blend];
    }
    const defines = shaderBlend ? shaderBlendDefines[shaderBlend] : [];

    painter.useProgram('layerComposite', null, false, defines).draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, colorMode, CullFaceMode.disabled,
        layerCompositeUniformValues(opacity, 0, 1, [bx, by]), null, null,
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);

    gl.disable(gl.SCISSOR_TEST);

    // Clipping masks went into the scratch FBO's stencil buffer, so a later layer on the same source must redraw its own.
    painter.currentStencilSource = undefined;
}

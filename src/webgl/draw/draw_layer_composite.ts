import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {ColorMode} from '../color_mode.ts';
import {layerCompositeUniformValues} from '../program/layer_composite_program.ts';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {EXTENT} from '../../data/extent.ts';

import type {Painter} from '../../render/painter.ts';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

/** The `{line,fill}-layer-blend` values. */
export type LayerBlend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'plus' | 'erase';

const blendDefines: Record<Exclude<LayerBlend, 'normal' | 'plus' | 'erase'>, string[]> = {
    multiply: ['#define LAYER_BLEND;', '#define LAYER_BLEND_MULTIPLY;'],
    screen: ['#define LAYER_BLEND;', '#define LAYER_BLEND_SCREEN;'],
    overlay: ['#define LAYER_BLEND;', '#define LAYER_BLEND_OVERLAY;']
};

const blendRequiresBackdrop: Record<LayerBlend, boolean> = {
    normal: false,
    plus: false,
    erase: false,
    multiply: true,
    screen: true,
    overlay: true
};

export type PrepareDrawLayerCompositeResult = {
    compositeTarget: WebGLFramebuffer | null;
    compositeViewport: [number, number, number, number];
    bounds: [number, number, number, number];
};

function getCoordsViewportBounds(painter: Painter, coords: OverscaledTileID[]): [number, number, number, number] {
    const viewport = painter.context.viewport.get();
    const [, , viewportWidth, viewportHeight] = viewport;

    if (coords.length === 0) {
        return [0, 0, 0, 0];
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const corners = [
        [0, 0],
        [EXTENT, 0],
        [0, EXTENT],
        [EXTENT, EXTENT]
    ];

    for (const coord of coords) {
        const matrix = coord.toMatrix(painter.transform);
        for (const [cx, cy] of corners) {
            const w = matrix[3] * cx + matrix[7] * cy + matrix[15];
            if (w <= 0) continue;
            const x = (matrix[0] * cx + matrix[4] * cy + matrix[12]) / w;
            const y = (matrix[1] * cx + matrix[5] * cy + matrix[13]) / w;

            const sx = (x + 1) * 0.5 * viewportWidth;
            const sy = (y + 1) * 0.5 * viewportHeight;

            if (sx < minX) minX = sx;
            if (sx > maxX) maxX = sx;
            if (sy < minY) minY = sy;
            if (sy > maxY) maxY = sy;
        }
    }

    const padding = 64;
    const x1 = Math.max(0, Math.floor(minX - padding));
    const y1 = Math.max(0, Math.floor(minY - padding));
    const x2 = Math.min(viewportWidth, Math.ceil(maxX + padding));
    const y2 = Math.min(viewportHeight, Math.ceil(maxY + padding));

    if (x2 <= x1 || y2 <= y1) {
        return [0, 0, 0, 0];
    }

    return [x1, y1, x2 - x1, y2 - y1];
}

/**
 * Partial `{line,fill}-layer-opacity` / `{line,fill}-layer-blend`:
 * render the whole layer to a scratch FBO so it composites as one surface instead of per feature.
 */
export function prepareDrawLayerComposite(painter: Painter, layer: LineStyleLayer | FillStyleLayer, coords: OverscaledTileID[], terrain: boolean): PrepareDrawLayerCompositeResult {
    const context = painter.context;
    const compositeTarget = context.bindFramebuffer.get();
    const compositeViewport = context.viewport.get();
    const [, , width, height] = compositeViewport;

    bindLayerComposite(painter, width, height);

    context.viewport.set([0, 0, width, height]);
    context.clear({color: Color.transparent, depth: 1, stencil: 0});

    painter.currentStencilSource = undefined;
    painter.renderTileClippingMasks(layer, coords, terrain);

    const bounds = getCoordsViewportBounds(painter, coords);

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

/** Copies the bound target's viewport into a texture, since a blend mode cannot sample the framebuffer it draws into. */
function copyBackdrop(painter: Painter, x: number, y: number, width: number, height: number): void {
    const gl = painter.context.gl;
    const backdrop = painter.layerCompositeBackdrop;
    const [, , viewportWidth, viewportHeight] = painter.context.viewport.get();

    if (!backdrop) {
        painter.layerCompositeBackdrop = {texture: createCompositeTexture(painter, viewportWidth, viewportHeight), width: viewportWidth, height: viewportHeight};
    } else if (backdrop.width !== viewportWidth || backdrop.height !== viewportHeight) {
        gl.bindTexture(gl.TEXTURE_2D, backdrop.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, viewportWidth, viewportHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        backdrop.width = viewportWidth;
        backdrop.height = viewportHeight;
    } else {
        gl.bindTexture(gl.TEXTURE_2D, backdrop.texture);
    }
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, x, y, x, y, width, height);
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

    const requiresBackdrop = blendRequiresBackdrop[blend];

    if (requiresBackdrop) {
        context.activeTexture.set(gl.TEXTURE1);
        copyBackdrop(painter, bx, by, bw, bh);
    }

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, painter.layerCompositeFbo.colorAttachment.get());

    let colorMode: Readonly<ColorMode>;
    if (requiresBackdrop) {
        colorMode = painter._showOverdrawInspector ? painter.colorModeForRenderPass() : ColorMode.unblended;
    } else if (blend === 'normal') {
        colorMode = painter.colorModeForRenderPass();
    } else if (blend === 'plus') {
        colorMode = ColorMode.plus;
    } else { // erase
        colorMode = ColorMode.erase;
    }
    const defines = requiresBackdrop ? blendDefines[blend] : [];

    painter.useProgram('layerComposite', null, false, defines).draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, colorMode, CullFaceMode.disabled,
        layerCompositeUniformValues(opacity, 0, 1), null, null,
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);

    gl.disable(gl.SCISSOR_TEST);

    // Clipping masks went into the scratch FBO's stencil buffer, so a later layer on the same source must redraw its own.
    painter.currentStencilSource = undefined;
}

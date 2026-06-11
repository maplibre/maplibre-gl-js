import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';
import {layerOpacityUniformValues} from '../program/layer_opacity_program.ts';

import type {Painter} from '../../render/painter.ts';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import type {Framebuffer} from '../framebuffer.ts';

/**
 * In-flight `{line,fill}-layer-opacity` subpass.
 *
 * Constructed by {@link Painter.redirectLayerToScratch} which captures the composite framebuffer / viewport, binds
 * the painter's shared scratch FBO, clears it, and writes the layer's clipping masks.
 * The caller then renders the layer into the scratch FBO and finishes by calling {@link compositeWithOpacity}.
 * This restores the previously bound framebuffer / viewport and composites the scratch FBO's color attachment with `opacity` as a uniform multiplier.
 */
export class PendingLayerComposite {
    private readonly painter: Painter;
    private readonly layer: LineStyleLayer | FillStyleLayer;
    private readonly scratchFbo: Framebuffer;
    private readonly compositeTarget: WebGLFramebuffer;
    private readonly compositeViewport: [number, number, number, number];

    constructor(
        painter: Painter,
        layer: LineStyleLayer | FillStyleLayer,
        scratchFbo: Framebuffer,
        compositeTarget: WebGLFramebuffer,
        compositeViewport: [number, number, number, number],
    ) {
        this.painter = painter;
        this.layer = layer;
        this.scratchFbo = scratchFbo;
        this.compositeTarget = compositeTarget;
        this.compositeViewport = compositeViewport;
    }

    compositeWithOpacity(opacity: number): void {
        const painter = this.painter;
        const context = painter.context;
        const gl = context.gl;

        context.bindFramebuffer.set(this.compositeTarget);
        context.viewport.set(this.compositeViewport);

        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.scratchFbo.colorAttachment.get());

        painter.useProgram('layerOpacity').draw(context, gl.TRIANGLES,
            DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
            layerOpacityUniformValues(opacity, 0), null, null,
            this.layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
            painter.viewportSegments, this.layer.paint, painter.transform.zoom);
    }
}

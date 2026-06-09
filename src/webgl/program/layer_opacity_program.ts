import {Color} from '@maplibre/maplibre-gl-style-spec';
import {Uniform1i, Uniform1f} from '../uniform_binding.ts';
import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';
import {CullFaceMode} from '../cull_face_mode.ts';

import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';
import type {Painter} from '../../render/painter.ts';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import type {OverscaledTileID} from '../../tile/tile_id.ts';

export type LayerOpacityUniformsType = {
    'u_image': Uniform1i;
    'u_opacity': Uniform1f;
};

const layerOpacityUniforms = (context: Context, locations: UniformLocations): LayerOpacityUniformsType => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_opacity': new Uniform1f(context, locations.u_opacity)
});

const layerOpacityUniformValues = (
    opacity: number,
    textureUnit: number
): UniformValues<LayerOpacityUniformsType> => ({
    'u_image': textureUnit,
    'u_opacity': opacity
});

type LayerOpacityLayer = LineStyleLayer | FillStyleLayer;

/**
 * Sub-pass for `{line,fill}-layer-opacity`.
 * Renders the layer image into the shared scratch FBO at the target framebuffer's resolution via `renderToScratch`.
 * Then it composites it back into the previously bound framebuffer with `opacity` as a multiplier.
 * Canvas in the flat case, a terrain RTT tile texture in the terrain case.
 *
 * Compositing this way (single quad per layer) applies opacity uniformly to the
 * whole layer output instead of accumulating alpha across overlapping geometry.
 */
const drawLayerOpacitySubpass = (
    painter: Painter,
    layer: LayerOpacityLayer,
    coords: OverscaledTileID[],
    opacity: number,
    terrain: boolean,
    renderToScratch: () => void
): void => {
    const context = painter.context;
    const gl = context.gl;

    const prevFramebuffer = context.bindFramebuffer.get();
    const prevViewport = context.viewport.get();
    const [, , width, height] = prevViewport;

    const scratchFbo = painter.bindLayerOpacityScratch(width, height);
    context.viewport.set([0, 0, width, height]);
    context.clear({color: Color.transparent, depth: 1, stencil: 0});

    painter.currentStencilSource = undefined;
    painter._renderTileClippingMasks(layer, coords, terrain);

    renderToScratch();

    context.bindFramebuffer.set(prevFramebuffer);
    context.viewport.set(prevViewport);

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scratchFbo.colorAttachment.get());

    painter.useProgram('layerOpacity').draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        layerOpacityUniformValues(opacity, 0), null, null,
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
};

export {
    layerOpacityUniforms,
    layerOpacityUniformValues,
    drawLayerOpacitySubpass
};

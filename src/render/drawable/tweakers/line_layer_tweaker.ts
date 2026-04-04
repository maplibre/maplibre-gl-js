import {LayerTweaker} from '../layer_tweaker';
import {UniformBlock} from '../uniform_block';
import type {Drawable} from '../drawable';
import type {Painter} from '../../painter';
import type {StyleLayer} from '../../../style/style_layer';
import type {LineStyleLayer} from '../../../style/style_layer/line_style_layer';
import type {OverscaledTileID} from '../../../tile/tile_id';
import {pixelsToTileUnits} from '../../../source/pixels_to_tile_units';

// LineEvaluatedPropsUBO layout (48 bytes, 16-byte aligned):
// color:       vec4<f32>     offset 0   (16 bytes)
// blur:        f32           offset 16
// opacity:     f32           offset 20
// gapwidth:    f32           offset 24
// offset:      f32           offset 28
// width:       f32           offset 32
// floorwidth:  f32           offset 36
// pad1:        f32           offset 40
// pad2:        f32           offset 44
const LINE_PROPS_UBO_SIZE = 48;

/**
 * Per-frame uniform updater for line layers.
 * Handles 5 shader variants: line, lineSDF, linePattern, lineGradient, lineGradientSDF.
 */
export class LineLayerTweaker extends LayerTweaker {

    constructor(layerId: string) {
        super(layerId);
    }

    execute(
        drawables: Drawable[],
        painter: Painter,
        layer: StyleLayer,
        _coords: Array<OverscaledTileID>
    ): void {
        const lineLayer = layer as LineStyleLayer;
        const transform = painter.transform;

        // Update evaluated props UBO if properties changed
        if (this.propertiesUpdated) {
            if (!this.evaluatedPropsUBO) {
                this.evaluatedPropsUBO = new UniformBlock(LINE_PROPS_UBO_SIZE);
            }
            const propsUBO = this.evaluatedPropsUBO;
            const paint = lineLayer.paint;

            // color vec4
            const color = paint.get('line-color').constantOr(null);
            if (color) {
                propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
            }

            // blur f32
            const blur = paint.get('line-blur').constantOr(null);
            if (blur !== null) {
                propsUBO.setFloat(16, blur);
            }

            // opacity f32
            const opacity = paint.get('line-opacity').constantOr(null);
            if (opacity !== null) {
                propsUBO.setFloat(20, opacity);
            }

            // gapwidth f32
            const gapwidth = paint.get('line-gap-width').constantOr(null);
            if (gapwidth !== null) {
                propsUBO.setFloat(24, gapwidth);
            }

            // offset f32
            const offset = paint.get('line-offset').constantOr(null);
            if (offset !== null) {
                propsUBO.setFloat(28, offset);
            }

            // width f32
            const width = paint.get('line-width').constantOr(null);
            if (width !== null) {
                propsUBO.setFloat(32, width);
            }

            this.propertiesUpdated = false;
        }

        // Update per-drawable data
        const zoom = transform.zoom;
        const pixelScale = transform.getPixelScale();

        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            // projectionData is already set during drawable creation with correct RTT flags
            const isLineSDF = drawable.shaderName === 'lineSDF';
            const isLineGradient = drawable.shaderName === 'lineGradient' || drawable.shaderName === 'lineGradientSDF';

            // LineDrawableUBO: matrix(64) + ratio(4) + device_pixel_ratio(4) + units_to_pixels(8) = 80 bytes
            // LineSDFDrawableUBO: extends to 160 bytes with patternscale, tex_y, sdfgamma, mix, _t factors
            // LineGradientDrawableUBO: same as LineDrawableUBO (80 bytes)
            const uboSize = isLineSDF ? 160 : 80;
            if (!drawable.drawableUBO || (drawable.drawableUBO as any)._byteLength < uboSize) {
                drawable.drawableUBO = new UniformBlock(uboSize);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);
            const tileProxy = {tileID: drawable.tileID, tileSize: transform.tileSize};

            if (isLineSDF) {
                // LineSDFDrawableUBO layout:
                // matrix: mat4x4 @ 0 (64)
                // patternscale_a: vec2 @ 64 (8)
                // patternscale_b: vec2 @ 72 (8)
                // tex_y_a: f32 @ 80 (4)
                // tex_y_b: f32 @ 84 (4)
                // ratio: f32 @ 88 (4)
                // device_pixel_ratio: f32 @ 92 (4)
                // units_to_pixels: vec2 @ 96 (8)
                // sdfgamma, mix: f32 @ 104, 108
                // _t factors: @ 112+
                const ratio = pixelScale / pixelsToTileUnits(tileProxy, 1, zoom);
                drawable.drawableUBO.setFloat(88, ratio);
                drawable.drawableUBO.setFloat(92, painter.pixelRatio);
                drawable.drawableUBO.setVec2(96, 1 / transform.pixelsToGLUnits[0], 1 / transform.pixelsToGLUnits[1]);
                // patternscale, tex_y, sdfgamma, mix are set from uniformValues in draw_line.ts
                if (drawable.uniformValues) {
                    const uv = drawable.uniformValues as any;
                    if (uv.u_patternscale_a) drawable.drawableUBO.setVec2(64, uv.u_patternscale_a[0], uv.u_patternscale_a[1]);
                    if (uv.u_patternscale_b) drawable.drawableUBO.setVec2(72, uv.u_patternscale_b[0], uv.u_patternscale_b[1]);
                    if (uv.u_tex_y_a !== undefined) drawable.drawableUBO.setFloat(80, uv.u_tex_y_a);
                    if (uv.u_tex_y_b !== undefined) drawable.drawableUBO.setFloat(84, uv.u_tex_y_b);
                    if (uv.u_sdfgamma !== undefined) drawable.drawableUBO.setFloat(104, uv.u_sdfgamma);
                    if (uv.u_mix !== undefined) drawable.drawableUBO.setFloat(108, uv.u_mix);
                }
            } else {
                // Basic line / lineGradient: 80-byte UBO
                drawable.drawableUBO.setFloat(64, pixelScale / pixelsToTileUnits(tileProxy, 1, zoom));
                drawable.drawableUBO.setFloat(68, painter.pixelRatio);
                drawable.drawableUBO.setVec2(72, 1 / transform.pixelsToGLUnits[0], 1 / transform.pixelsToGLUnits[1]);
            }

            // Share the layer-level UBO reference
            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }
}

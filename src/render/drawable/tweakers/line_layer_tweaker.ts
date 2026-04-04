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

        // Update evaluated props UBO — must run every frame for zoom-dependent properties
        if (!this.evaluatedPropsUBO) {
            this.evaluatedPropsUBO = new UniformBlock(LINE_PROPS_UBO_SIZE);
        }
        const propsUBO = this.evaluatedPropsUBO;
        const paint = lineLayer.paint;
        const evalParams = {zoom: transform.zoom};

        // Helper: get constant or evaluate zoom-dependent value
        const getFloat = (prop: string): number | null => {
            const val = paint.get(prop as any);
            const c = val.constantOr(undefined);
            if (c !== undefined) return c as number;
            if (val && typeof (val as any).evaluate === 'function') {
                return (val as any).evaluate(evalParams);
            }
            return null;
        };

        // color vec4
        const color = paint.get('line-color').constantOr(null);
        if (color) {
            propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
        }

        // blur f32
        const blur = getFloat('line-blur');
        if (blur !== null) propsUBO.setFloat(16, blur);

        // opacity f32 (often zoom-dependent!)
        const opacity = getFloat('line-opacity');
        if (opacity !== null) propsUBO.setFloat(20, opacity);

        // gapwidth f32
        const gapwidth = getFloat('line-gap-width');
        if (gapwidth !== null) propsUBO.setFloat(24, gapwidth);

        // offset f32
        const offset = getFloat('line-offset');
        if (offset !== null) propsUBO.setFloat(28, offset);

        // width f32
        const width = getFloat('line-width');
        if (width !== null) propsUBO.setFloat(32, width);

        // floorwidth f32 = max(width, 1.0)
        const floorwidth = Math.max(width || 0, 1.0);
        propsUBO.setFloat(36, floorwidth);

        this.propertiesUpdated = false;

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

                // Compute patternscale/tex_y from uniform values and dash positions
                if (drawable.uniformValues) {
                    const uv = drawable.uniformValues as any;
                    const tileratio = uv.u_tileratio || 1;
                    const crossfadeFrom = uv.u_crossfade_from || 1;
                    const crossfadeTo = uv.u_crossfade_to || 1;
                    const atlasHeight = uv.u_lineatlas_height || 1;
                    const mixVal = uv.u_mix || 0;

                    // Get dash positions from ProgramConfiguration binders
                    // dasharray_from/to = [0, y, height, width]
                    let dashFrom = [0, 0, 0, 1];
                    let dashTo = [0, 0, 0, 1];
                    if (drawable.programConfiguration) {
                        const binders = (drawable.programConfiguration as any).binders;
                        for (const key in binders) {
                            const b = binders[key];
                            if (b && b.dashFrom) { dashFrom = b.dashFrom; }
                            if (b && b.dashTo) { dashTo = b.dashTo; }
                        }
                    }

                    // Compute patternscale_a/b (matching GLSL line_sdf.vertex.glsl)
                    const psx_a = tileratio / Math.max(dashFrom[3], 1e-6) / Math.max(crossfadeFrom, 1e-6);
                    const psy_a = -(dashFrom[2] || 0) / 2.0 / atlasHeight;
                    const psx_b = tileratio / Math.max(dashTo[3], 1e-6) / Math.max(crossfadeTo, 1e-6);
                    const psy_b = -(dashTo[2] || 0) / 2.0 / atlasHeight;

                    drawable.drawableUBO.setVec2(64, psx_a, psy_a);
                    drawable.drawableUBO.setVec2(72, psx_b, psy_b);

                    // tex_y_a/b = (dashFrom/To.y + 0.5) / atlasHeight
                    drawable.drawableUBO.setFloat(80, ((dashFrom[1] || 0) + 0.5) / atlasHeight);
                    drawable.drawableUBO.setFloat(84, ((dashTo[1] || 0) + 0.5) / atlasHeight);

                    // sdfgamma (matching native: 1.0 / (2.0 * pixelRatio))
                    drawable.drawableUBO.setFloat(104, 1.0 / (2.0 * painter.pixelRatio));
                    drawable.drawableUBO.setFloat(108, mixVal);
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

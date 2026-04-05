import {LayerTweaker} from '../layer_tweaker';
import {UniformBlock} from '../uniform_block';
import type {Drawable} from '../drawable';
import type {Painter} from '../../painter';
import type {StyleLayer} from '../../../style/style_layer';
import type {FillStyleLayer} from '../../../style/style_layer/fill_style_layer';
import type {OverscaledTileID} from '../../../tile/tile_id';

// FillEvaluatedPropsUBO layout (48 bytes, 16-byte aligned):
// color:           vec4<f32>     offset 0   (16 bytes)
// outline_color:   vec4<f32>     offset 16  (16 bytes)
// opacity:         f32           offset 32
// fade:            f32           offset 36
// from_scale:      f32           offset 40
// to_scale:        f32           offset 44
const FILL_PROPS_UBO_SIZE = 48;

/**
 * Per-frame uniform updater for fill layers.
 * Handles 4 shader variants: fill, fillOutline, fillPattern, fillOutlinePattern.
 */
export class FillLayerTweaker extends LayerTweaker {

    constructor(layerId: string) {
        super(layerId);
    }

    execute(
        drawables: Drawable[],
        painter: Painter,
        layer: StyleLayer,
        _coords: Array<OverscaledTileID>
    ): void {
        const fillLayer = layer as FillStyleLayer;
        const transform = painter.transform;

        // Evaluate paint properties every frame — camera functions re-evaluate
        // on zoom change via layer.recalculate(), so constantOr picks up new values.
        // Data-driven properties use vertex attributes, not the UBO.
        if (!this.evaluatedPropsUBO) {
            this.evaluatedPropsUBO = new UniformBlock(FILL_PROPS_UBO_SIZE);
        }
        const propsUBO = this.evaluatedPropsUBO;
        const paint = fillLayer.paint;

        // color vec4
        const colorVal = paint.get('fill-color') as any;
        const color = colorVal.constantOr ? colorVal.constantOr(null) : (colorVal && typeof colorVal === 'object' && 'r' in colorVal ? colorVal : null);
        if (color) {
            propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
        }
        // outline_color vec4 (falls back to fill-color if not explicitly set)
        const outlineColorVal = paint.get('fill-outline-color') as any;
        const outlineColor = outlineColorVal.constantOr ? outlineColorVal.constantOr(null) : (outlineColorVal && typeof outlineColorVal === 'object' && 'r' in outlineColorVal ? outlineColorVal : null);
        const effectiveOutlineColor = outlineColor || color;
        if (effectiveOutlineColor) {
            propsUBO.setVec4(16, effectiveOutlineColor.r, effectiveOutlineColor.g, effectiveOutlineColor.b, effectiveOutlineColor.a);
        }

        // opacity f32 — constantOr(null) may return null for DataDrivenProperty defaults,
        // so fall back to 1.0 (the spec default for fill-opacity)
        const opacityVal = paint.get('fill-opacity') as any;
        const opacity = opacityVal.constantOr ? opacityVal.constantOr(1.0) : (typeof opacityVal === 'number' ? opacityVal : 1.0);
        propsUBO.setFloat(32, opacity as number);

        if (!(this as any)._logged) {
            const f32 = new Float32Array(propsUBO._data);
            console.log(`[FILL TWEAKER v2] layer=${this.layerId} opacity_raw=${opacity} ubo_opacity=${f32[8].toFixed(3)} ubo_color=[${f32[0].toFixed(3)},${f32[1].toFixed(3)},${f32[2].toFixed(3)},${f32[3].toFixed(3)}]`);
            (this as any)._logged = true;
        }

        // Update crossfade parameters
        const crossfade = fillLayer.getCrossfadeParameters();
        if (this.evaluatedPropsUBO && crossfade) {
            this.evaluatedPropsUBO.setFloat(36, crossfade.t);
            this.evaluatedPropsUBO.setFloat(40, crossfade.fromScale);
            this.evaluatedPropsUBO.setFloat(44, crossfade.toScale);
        }

        // Update per-drawable data
        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            // projectionData is already set during drawable creation with correct RTT flags

            // FillDrawableUBO: matrix(64) + color_t(4) + opacity_t(4) + pad(8) = 80 bytes
            if (!drawable.drawableUBO) {
                drawable.drawableUBO = new UniformBlock(80);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

            // Set interpolation _t factors for data-driven (composite) properties
            if (drawable.programConfiguration) {
                const binders = (drawable.programConfiguration as any).binders;
                if (binders) {
                    const zoom = transform.zoom;
                    for (const [prop, offset] of [['fill-color', 64], ['fill-opacity', 68], ['fill-outline-color', 64], ['fill-opacity', 68]] as const) {
                        const binder = binders[prop];
                        if (binder && binder.expression && binder.expression.interpolationFactor) {
                            const currentZoom = binder.useIntegerZoom ? Math.floor(zoom) : zoom;
                            const t = Math.max(0, Math.min(1, binder.expression.interpolationFactor(currentZoom, binder.zoom, binder.zoom + 1)));
                            drawable.drawableUBO.setFloat(offset, t);
                        }
                    }
                }
            }

            // Share the layer-level UBO reference
            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }
}

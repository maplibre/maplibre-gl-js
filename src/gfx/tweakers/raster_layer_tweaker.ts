import {LayerTweaker} from '../layer_tweaker';
import {UniformBlock} from '../uniform_block';
import type {Drawable} from '../drawable';
import type {Painter} from '../../render/painter';
import type {StyleLayer} from '../../style/style_layer';
import type {OverscaledTileID} from '../../tile/tile_id';

// RasterDrawableUBO: matrix mat4x4<f32> = 64 bytes
const RASTER_DRAWABLE_UBO_SIZE = 64;

// RasterEvaluatedPropsUBO:
// spin_weights: vec4 (16)
// tl_parent: vec2 (8)
// scale_parent: f32 (4)
// buffer_scale: f32 (4)
// fade_t: f32 (4)
// opacity: f32 (4)
// brightness_low: f32 (4)
// brightness_high: f32 (4)
// saturation_factor: f32 (4)
// contrast_factor: f32 (4)
// pad1, pad2: f32 (8)
const RASTER_PROPS_UBO_SIZE = 64;

export class RasterLayerTweaker extends LayerTweaker {

    constructor(layerId: string) {
        super(layerId);
    }

    execute(
        drawables: Drawable[],
        painter: Painter,
        layer: StyleLayer,
        _coords: Array<OverscaledTileID>
    ): void {
        // Props UBO is set per-drawable from uniformValues (since each tile has different fade properties)

        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            // projectionData is already set during drawable creation
            if (!drawable.drawableUBO) {
                drawable.drawableUBO = new UniformBlock(RASTER_DRAWABLE_UBO_SIZE);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

            // Props UBO from uniform values (per-tile fade properties)
            if (!drawable.layerUBO && drawable.uniformValues) {
                const ubo = new UniformBlock(RASTER_PROPS_UBO_SIZE);
                const uv = drawable.uniformValues as any;

                // spin_weights vec4 @ 0
                if (uv.u_spin_weights) ubo.setVec4(0, uv.u_spin_weights[0], uv.u_spin_weights[1], uv.u_spin_weights[2], 0);
                // tl_parent vec2 @ 16
                if (uv.u_tl_parent) ubo.setVec2(16, uv.u_tl_parent[0], uv.u_tl_parent[1]);
                // scale_parent f32 @ 24
                if (uv.u_scale_parent !== undefined) ubo.setFloat(24, uv.u_scale_parent);
                // buffer_scale f32 @ 28
                if (uv.u_buffer_scale !== undefined) ubo.setFloat(28, uv.u_buffer_scale);
                // fade_t f32 @ 32
                if (uv.u_fade_t !== undefined) ubo.setFloat(32, uv.u_fade_t);
                // opacity f32 @ 36
                if (uv.u_opacity !== undefined) ubo.setFloat(36, uv.u_opacity);
                // brightness_low f32 @ 40
                if (uv.u_brightness_low !== undefined) ubo.setFloat(40, uv.u_brightness_low);
                // brightness_high f32 @ 44
                if (uv.u_brightness_high !== undefined) ubo.setFloat(44, uv.u_brightness_high);
                // saturation_factor f32 @ 48
                if (uv.u_saturation_factor !== undefined) ubo.setFloat(48, uv.u_saturation_factor);
                // contrast_factor f32 @ 52
                if (uv.u_contrast_factor !== undefined) ubo.setFloat(52, uv.u_contrast_factor);

                drawable.layerUBO = ubo;
            }
        }
    }
}

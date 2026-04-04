import {LayerTweaker} from '../layer_tweaker';
import {UniformBlock} from '../uniform_block';
import type {Drawable} from '../drawable';
import type {Painter} from '../../painter';
import type {StyleLayer} from '../../../style/style_layer';
import type {CircleStyleLayer} from '../../../style/style_layer/circle_style_layer';
import type {OverscaledTileID} from '../../../tile/tile_id';
import {pixelsToTileUnits} from '../../../source/pixels_to_tile_units';
import {EXTENT} from '../../../data/extent';
import {translatePosition} from '../../../util/util';

// CircleDrawableUBO layout (112 bytes, 16-byte aligned):
// matrix:            mat4x4<f32>   offset 0   (64 bytes)
// extrude_scale:     vec2<f32>     offset 64  (8 bytes)
// color_t:           f32           offset 72
// radius_t:          f32           offset 76
// blur_t:            f32           offset 80
// opacity_t:         f32           offset 84
// stroke_color_t:    f32           offset 88
// stroke_width_t:    f32           offset 92
// stroke_opacity_t:  f32           offset 96
// pad1:              f32           offset 100
// pad2:              f32           offset 104
// pad3:              f32           offset 108
const CIRCLE_DRAWABLE_UBO_SIZE = 112;

// CircleEvaluatedPropsUBO layout (64 bytes, 16-byte aligned):
// color:             vec4<f32>     offset 0   (16 bytes)
// stroke_color:      vec4<f32>     offset 16  (16 bytes)
// radius:            f32           offset 32
// blur:              f32           offset 36
// opacity:           f32           offset 40
// stroke_width:      f32           offset 44
// stroke_opacity:    f32           offset 48
// scale_with_map:    i32           offset 52
// pitch_with_map:    i32           offset 56
// pad1:              f32           offset 60
const CIRCLE_PROPS_UBO_SIZE = 64;

/**
 * Per-frame uniform updater for circle layers.
 * Mirrors native's CircleLayerTweaker.
 */
export class CircleLayerTweaker extends LayerTweaker {

    constructor(layerId: string) {
        super(layerId);
    }

    execute(
        drawables: Drawable[],
        painter: Painter,
        layer: StyleLayer,
        _coords: Array<OverscaledTileID>
    ): void {
        const circleLayer = layer as CircleStyleLayer;
        const transform = painter.transform;

        // Update evaluated props UBO if properties changed
        if (this.propertiesUpdated) {
            if (!this.evaluatedPropsUBO) {
                this.evaluatedPropsUBO = new UniformBlock(CIRCLE_PROPS_UBO_SIZE);
            }
            const propsUBO = this.evaluatedPropsUBO;
            const paint = circleLayer.paint;

            // color vec4
            const color = paint.get('circle-color').constantOr(null);
            if (color) {
                propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
            }

            // stroke_color vec4
            const strokeColor = paint.get('circle-stroke-color').constantOr(null);
            if (strokeColor) {
                propsUBO.setVec4(16, strokeColor.r, strokeColor.g, strokeColor.b, strokeColor.a);
            }

            // radius f32
            const radius = paint.get('circle-radius').constantOr(null);
            if (radius !== null) {
                propsUBO.setFloat(32, radius);
            }

            // blur f32
            const blur = paint.get('circle-blur').constantOr(null);
            if (blur !== null) {
                propsUBO.setFloat(36, blur);
            }

            // opacity f32
            const opacity = paint.get('circle-opacity').constantOr(null);
            if (opacity !== null) {
                propsUBO.setFloat(40, opacity);
            }

            // stroke_width f32
            const strokeWidth = paint.get('circle-stroke-width').constantOr(null);
            if (strokeWidth !== null) {
                propsUBO.setFloat(44, strokeWidth);
            }

            // stroke_opacity f32
            const strokeOpacity = paint.get('circle-stroke-opacity').constantOr(null);
            if (strokeOpacity !== null) {
                propsUBO.setFloat(48, strokeOpacity);
            }

            // scale_with_map i32
            propsUBO.setInt(52, +(paint.get('circle-pitch-scale') === 'map'));

            // pitch_with_map i32
            propsUBO.setInt(56, +(paint.get('circle-pitch-alignment') === 'map'));

            this.propertiesUpdated = false;
        }

        // Update per-drawable UBOs
        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            const tileID = drawable.tileID;
            const tile = painter.style.map.terrain ?
                null : // terrain tiles handled separately
                null;

            // Get tile from tileManager - but we don't have direct access here.
            // The matrix and other per-tile data was already set up during drawable creation.
            // The tweaker's job is to UPDATE these values each frame when the camera moves.

            if (!drawable.drawableUBO) {
                drawable.drawableUBO = new UniformBlock(CIRCLE_DRAWABLE_UBO_SIZE);
            }
            const ubo = drawable.drawableUBO;

            // projectionData is already set during drawable creation with correct RTT flags
            ubo.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

            // extrude_scale
            const pitchWithMap = circleLayer.paint.get('circle-pitch-alignment') === 'map';
            let extrudeScale: [number, number];
            if (pitchWithMap) {
                // We need the tile to compute pixelsToTileUnits - get it from tileManager
                // For now compute from zoom level
                const scale = transform.zoom;
                const pixelRatio = pixelsToTileUnits({tileID} as any, 1, scale);
                extrudeScale = [pixelRatio, pixelRatio];
            } else {
                extrudeScale = transform.pixelsToGLUnits as [number, number];
            }
            ubo.setVec2(64, extrudeScale[0], extrudeScale[1]);

            // Interpolation factors from programConfiguration
            // These are the `_t` values for zoom interpolation of data-driven properties
            if (drawable.programConfiguration) {
                const binders = (drawable.programConfiguration as any).binders;
                if (binders) {
                    const zoom = painter.transform.zoom;
                    const props = ['color', 'radius', 'blur', 'opacity', 'stroke_color', 'stroke_width', 'stroke_opacity'];
                    const offsets = [72, 76, 80, 84, 88, 92, 96];
                    for (let i = 0; i < props.length; i++) {
                        const binder = binders[`circle-${props[i].replace(/_/g, '-')}`];
                        if (binder && binder.interpolationFactor) {
                            ubo.setFloat(offsets[i], binder.interpolationFactor(zoom));
                        } else {
                            ubo.setFloat(offsets[i], 0);
                        }
                    }
                }
            }

            // Share the layer-level UBO reference
            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }
}

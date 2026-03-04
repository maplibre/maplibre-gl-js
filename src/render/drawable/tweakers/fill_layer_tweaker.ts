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

        // Update evaluated props UBO if properties changed
        if (this.propertiesUpdated) {
            if (!this.evaluatedPropsUBO) {
                this.evaluatedPropsUBO = new UniformBlock(FILL_PROPS_UBO_SIZE);
            }
            const propsUBO = this.evaluatedPropsUBO;
            const paint = fillLayer.paint;

            // color vec4
            const color = paint.get('fill-color').constantOr(null);
            if (color) {
                propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
            }

            // outline_color vec4
            const outlineColor = paint.get('fill-outline-color').constantOr(null);
            if (outlineColor) {
                propsUBO.setVec4(16, outlineColor.r, outlineColor.g, outlineColor.b, outlineColor.a);
            }

            // opacity f32
            const opacity = paint.get('fill-opacity').constantOr(null);
            if (opacity !== null) {
                propsUBO.setFloat(32, opacity);
            }

            // fade, from_scale, to_scale set from crossfade (per-frame, below)
            this.propertiesUpdated = false;
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

            // Update projection data from current transform
            const projectionData = transform.getProjectionData({
                overscaledTileID: drawable.tileID,
                applyGlobeMatrix: true,
                applyTerrainMatrix: true
            });
            drawable.projectionData = projectionData;

            // Share the layer-level UBO reference
            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }
}

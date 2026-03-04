import {LayerTweaker} from '../layer_tweaker';
import {UniformBlock} from '../uniform_block';
import type {Drawable} from '../drawable';
import type {Painter} from '../../painter';
import type {StyleLayer} from '../../../style/style_layer';
import type {BackgroundStyleLayer} from '../../../style/style_layer/background_style_layer';
import type {OverscaledTileID} from '../../../tile/tile_id';

// BackgroundDrawableUBO: matrix mat4x4<f32> = 64 bytes
const BACKGROUND_DRAWABLE_UBO_SIZE = 64;

// BackgroundPropsUBO: color vec4 (16) + opacity f32 (4) + pad (12) = 32 bytes
const BACKGROUND_PROPS_UBO_SIZE = 32;

export class BackgroundLayerTweaker extends LayerTweaker {

    constructor(layerId: string) {
        super(layerId);
    }

    execute(
        drawables: Drawable[],
        painter: Painter,
        layer: StyleLayer,
        _coords: Array<OverscaledTileID>
    ): void {
        const bgLayer = layer as BackgroundStyleLayer;

        // Update evaluated props UBO
        if (this.propertiesUpdated) {
            if (!this.evaluatedPropsUBO) {
                this.evaluatedPropsUBO = new UniformBlock(BACKGROUND_PROPS_UBO_SIZE);
            }
            const propsUBO = this.evaluatedPropsUBO;
            const color = bgLayer.paint.get('background-color');
            const opacity = bgLayer.paint.get('background-opacity');

            propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
            propsUBO.setFloat(16, opacity);

            this.propertiesUpdated = false;
        }

        // Update per-drawable UBOs (matrix)
        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            if (!drawable.drawableUBO) {
                drawable.drawableUBO = new UniformBlock(BACKGROUND_DRAWABLE_UBO_SIZE);
            }

            const projectionData = painter.transform.getProjectionData({
                overscaledTileID: drawable.tileID,
                applyGlobeMatrix: true,
                applyTerrainMatrix: true
            });
            drawable.drawableUBO.setMat4(0, projectionData.mainMatrix as Float32Array);
            drawable.projectionData = projectionData;
            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }
}

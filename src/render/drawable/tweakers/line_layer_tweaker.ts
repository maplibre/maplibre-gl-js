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

            // Update projection data from current transform
            const projectionData = transform.getProjectionData({
                overscaledTileID: drawable.tileID,
                applyGlobeMatrix: true,
                applyTerrainMatrix: true
            });
            drawable.projectionData = projectionData;

            // Set drawableUBO with matrix + line-specific uniforms for WebGPU path
            // LineDrawableUBO: matrix(64) + ratio(4) + device_pixel_ratio(4) + units_to_pixels(8) = 80 bytes
            if (!drawable.drawableUBO) {
                drawable.drawableUBO = new UniformBlock(80);
            }
            drawable.drawableUBO.setMat4(0, projectionData.mainMatrix as Float32Array);
            const tileProxy = {tileID: drawable.tileID, tileSize: transform.tileSize};
            drawable.drawableUBO.setFloat(64, pixelScale / pixelsToTileUnits(tileProxy, 1, zoom));
            drawable.drawableUBO.setFloat(68, painter.pixelRatio);
            drawable.drawableUBO.setVec2(72, 1 / transform.pixelsToGLUnits[0], 1 / transform.pixelsToGLUnits[1]);

            // Share the layer-level UBO reference
            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }
}

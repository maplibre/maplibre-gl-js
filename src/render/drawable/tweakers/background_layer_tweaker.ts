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

// BackgroundPatternDrawableUBO: matrix(64) + pixel_coord_upper(8) + pixel_coord_lower(8) + tile_units_to_pixels(4) + pad(12) = 96
const BACKGROUND_PATTERN_DRAWABLE_UBO_SIZE = 96;

// BackgroundPatternPropsUBO: pattern_a(16) + pattern_b(16) + pattern_size_a(8) + pattern_size_b(8)
//   + scale_a(4) + scale_b(4) + mix(4) + opacity(4) + pad1(16) = 80 bytes but WebGPU requires 96
const BACKGROUND_PATTERN_PROPS_UBO_SIZE = 96;

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

        // Check if this is a pattern layer (first drawable's shader tells us)
        const firstDrawable = drawables.find(d => d.enabled && d.tileID);
        const isPattern = firstDrawable?.shaderName === 'backgroundPattern';

        if (isPattern) {
            this._executePattern(drawables, painter, bgLayer);
        } else {
            this._executeSolid(drawables, painter, bgLayer);
        }
    }

    private _executeSolid(
        drawables: Drawable[],
        painter: Painter,
        bgLayer: BackgroundStyleLayer
    ): void {
        // Update evaluated props UBO
        if (!this.evaluatedPropsUBO || (this.evaluatedPropsUBO as any)._byteLength !== BACKGROUND_PROPS_UBO_SIZE) {
            this.evaluatedPropsUBO = new UniformBlock(BACKGROUND_PROPS_UBO_SIZE);
        }
        const propsUBO = this.evaluatedPropsUBO;
        const color = bgLayer.paint.get('background-color');
        const opacity = bgLayer.paint.get('background-opacity');

        propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
        propsUBO.setFloat(16, opacity);

        // Update per-drawable UBOs (matrix)
        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            if (!drawable.drawableUBO || (drawable.drawableUBO as any)._byteLength !== BACKGROUND_DRAWABLE_UBO_SIZE) {
                drawable.drawableUBO = new UniformBlock(BACKGROUND_DRAWABLE_UBO_SIZE);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);
            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }

    private _executePattern(
        drawables: Drawable[],
        painter: Painter,
        bgLayer: BackgroundStyleLayer
    ): void {
        const opacity = bgLayer.paint.get('background-opacity');
        const image = bgLayer.paint.get('background-pattern');
        const crossfade = bgLayer.getCrossfadeParameters();

        if (!image || !crossfade) return;

        const imagePosA = painter.imageManager.getPattern((image as any).from.toString());
        const imagePosB = painter.imageManager.getPattern((image as any).to.toString());
        if (!imagePosA || !imagePosB) return;

        const {width: texsizeW, height: texsizeH} = painter.imageManager.getPixelSize();

        // Props UBO (shared across all drawables for this layer)
        if (!this.evaluatedPropsUBO || (this.evaluatedPropsUBO as any)._byteLength !== BACKGROUND_PATTERN_PROPS_UBO_SIZE) {
            this.evaluatedPropsUBO = new UniformBlock(BACKGROUND_PATTERN_PROPS_UBO_SIZE);
        }
        const propsUBO = this.evaluatedPropsUBO;

        // Layout matches BackgroundPatternPropsUBO in background_pattern.wgsl
        const tlA = (imagePosA as any).tl;
        const brA = (imagePosA as any).br;
        const tlB = (imagePosB as any).tl;
        const brB = (imagePosB as any).br;
        const sizeA = (imagePosA as any).displaySize;
        const sizeB = (imagePosB as any).displaySize;
        propsUBO.setVec4(0, tlA[0], tlA[1], brA[0], brA[1]);                                // pattern_a
        propsUBO.setVec4(16, tlB[0], tlB[1], brB[0], brB[1]);                               // pattern_b
        propsUBO.setVec4(32, sizeA[0], sizeA[1], sizeB[0], sizeB[1]);                       // pattern_sizes
        propsUBO.setVec4(48, crossfade.fromScale, crossfade.toScale, crossfade.t, opacity); // scale_mix_opacity
        // pad0 at 64, pad1 at 80 (unused)

        // Also update the global paint params with the pattern atlas texsize
        // (the shader reads texsize from paintParams.pattern_atlas_texsize)
        if (painter.globalUBO) {
            (painter.globalUBO as any).setVec2(0, texsizeW, texsizeH);
        }

        // Update per-drawable UBOs
        const transform = painter.transform;
        for (const drawable of drawables) {
            if (!drawable.enabled || !drawable.tileID) continue;

            if (!drawable.drawableUBO || (drawable.drawableUBO as any)._byteLength !== BACKGROUND_PATTERN_DRAWABLE_UBO_SIZE) {
                drawable.drawableUBO = new UniformBlock(BACKGROUND_PATTERN_DRAWABLE_UBO_SIZE);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

            // Compute pixel coordinates for this tile
            const tileID = drawable.tileID;
            const tileSize = transform.tileSize;
            const numTiles = Math.pow(2, tileID.overscaledZ);
            const tileSizeAtNearestZoom = tileSize * Math.pow(2, transform.tileZoom) / numTiles;
            const pixelX = tileSizeAtNearestZoom * (tileID.canonical.x + tileID.wrap * numTiles);
            const pixelY = tileSizeAtNearestZoom * tileID.canonical.y;

            // Split pixel coord into two pairs of 16 bit numbers (for precision)
            const pixel_upper_x = (pixelX >> 16) & 0xFFFF;
            const pixel_upper_y = (pixelY >> 16) & 0xFFFF;
            const pixel_lower_x = pixelX & 0xFFFF;
            const pixel_lower_y = pixelY & 0xFFFF;

            drawable.drawableUBO.setVec2(64, pixel_upper_x, pixel_upper_y);     // pixel_coord_upper
            drawable.drawableUBO.setVec2(72, pixel_lower_x, pixel_lower_y);     // pixel_coord_lower

            // tile_units_to_pixels = 1 / pixelsToTileUnits, matching GL's bgPatternUniformValues
            const overscale = Math.pow(2, transform.tileZoom - tileID.overscaledZ);
            const pixelsToTileUnitsVal = tileSize / overscale;
            const tile_units_to_pixels = pixelsToTileUnitsVal === 0 ? 0 : 1 / pixelsToTileUnitsVal;
            drawable.drawableUBO.setFloat(80, tile_units_to_pixels);

            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }
}

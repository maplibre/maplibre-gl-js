import {LayerTweaker} from '../layer_tweaker';
import {UniformBlock} from '../uniform_block';
import type {Drawable} from '../drawable';
import type {Painter} from '../../painter';
import type {StyleLayer} from '../../../style/style_layer';
import type {FillStyleLayer} from '../../../style/style_layer/fill_style_layer';
import type {OverscaledTileID} from '../../../tile/tile_id';

// FillEvaluatedPropsUBO layout (48 bytes, 16-byte aligned):
// color:           vec4<f32>     offset 0
// outline_color:   vec4<f32>     offset 16
// opacity:         f32           offset 32
// fade:            f32           offset 36
// from_scale:      f32           offset 40
// to_scale:        f32           offset 44
const FILL_PROPS_UBO_SIZE = 48;

// FillPatternPropsUBO: 96 bytes (WebGPU uniform binding minimum)
// pattern_from vec4(16) + pattern_to vec4(16) + display_sizes vec4(16) + scales_fade_opacity vec4(16) + texsize vec4(16) + pad vec4(16) = 96
const FILL_PATTERN_PROPS_UBO_SIZE = 96;
// FillPatternDrawableUBO: matrix(64) + pixel_coord_upper(8) + pixel_coord_lower(8) + tile_ratio(4) + pad(12) = 96
const FILL_PATTERN_DRAWABLE_UBO_SIZE = 96;

/**
 * Per-frame uniform updater for fill layers.
 * Handles shader variants: fill, fillOutline, fillPattern, fillOutlinePattern.
 */
export class FillLayerTweaker extends LayerTweaker {

    _patternPropsUBO: UniformBlock | null = null;

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

        // Separate drawables by shader type
        const patternDrawables: Drawable[] = [];
        const solidDrawables: Drawable[] = [];
        for (const d of drawables) {
            if (!d.enabled || !d.tileID) continue;
            if (d.shaderName === 'fillPattern' || d.shaderName === 'fillOutlinePattern') {
                patternDrawables.push(d);
            } else {
                solidDrawables.push(d);
            }
        }

        if (solidDrawables.length > 0) {
            this._updateSolid(solidDrawables, painter, fillLayer);
        }
        if (patternDrawables.length > 0) {
            this._updatePattern(patternDrawables, painter, fillLayer);
        }
    }

    private _updateSolid(drawables: Drawable[], painter: Painter, fillLayer: FillStyleLayer): void {
        const transform = painter.transform;

        if (!this.evaluatedPropsUBO || (this.evaluatedPropsUBO as any)._byteLength !== FILL_PROPS_UBO_SIZE) {
            this.evaluatedPropsUBO = new UniformBlock(FILL_PROPS_UBO_SIZE);
        }
        const propsUBO = this.evaluatedPropsUBO;
        const paint = fillLayer.paint;

        const color = (paint.get('fill-color') as any).constantOr(null);
        if (color) {
            propsUBO.setVec4(0, color.r, color.g, color.b, color.a);
        }

        const outlineColor = (paint.get('fill-outline-color') as any).constantOr(null);
        const effectiveOutlineColor = outlineColor || color;
        if (effectiveOutlineColor) {
            propsUBO.setVec4(16, effectiveOutlineColor.r, effectiveOutlineColor.g, effectiveOutlineColor.b, effectiveOutlineColor.a);
        }

        const opacity = (paint.get('fill-opacity') as any).constantOr(1.0);
        propsUBO.setFloat(32, opacity as number);

        const crossfade = fillLayer.getCrossfadeParameters();
        if (crossfade) {
            propsUBO.setFloat(36, crossfade.t);
            propsUBO.setFloat(40, crossfade.fromScale);
            propsUBO.setFloat(44, crossfade.toScale);
        }

        for (const drawable of drawables) {
            if (!drawable.drawableUBO || (drawable.drawableUBO as any)._byteLength !== 80) {
                drawable.drawableUBO = new UniformBlock(80);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

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

            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }

    private _updatePattern(drawables: Drawable[], painter: Painter, fillLayer: FillStyleLayer): void {
        const transform = painter.transform;
        const paint = fillLayer.paint;
        const image = paint.get('fill-pattern') as any;
        const imageValue = image?.constantOr ? image.constantOr(null) : image;
        if (!imageValue) return;

        const crossfade = fillLayer.getCrossfadeParameters();
        if (!crossfade) return;

        const imagePosA = painter.imageManager.getPattern(imageValue.from.toString());
        const imagePosB = painter.imageManager.getPattern(imageValue.to.toString());
        if (!imagePosA || !imagePosB) return;

        const {width: texW, height: texH} = painter.imageManager.getPixelSize();

        // Pattern props UBO (shared across pattern drawables)
        if (!this._patternPropsUBO || (this._patternPropsUBO as any)._byteLength !== FILL_PATTERN_PROPS_UBO_SIZE) {
            this._patternPropsUBO = new UniformBlock(FILL_PATTERN_PROPS_UBO_SIZE);
        }
        const propsUBO = this._patternPropsUBO;

        const tlA = (imagePosA as any).tl;
        const brA = (imagePosA as any).br;
        const tlB = (imagePosB as any).tl;
        const brB = (imagePosB as any).br;
        const sizeA = (imagePosA as any).displaySize;
        const sizeB = (imagePosB as any).displaySize;
        const opacity = (paint.get('fill-opacity') as any).constantOr(1.0);

        propsUBO.setVec4(0, tlA[0], tlA[1], brA[0], brA[1]);                                  // pattern_from
        propsUBO.setVec4(16, tlB[0], tlB[1], brB[0], brB[1]);                                 // pattern_to
        propsUBO.setVec4(32, sizeA[0], sizeA[1], sizeB[0], sizeB[1]);                         // display_sizes
        propsUBO.setVec4(48, crossfade.fromScale, crossfade.toScale, crossfade.t, opacity);   // scales_fade_opacity
        propsUBO.setVec4(64, texW, texH, 0, 0);                                               // texsize

        // Update per-drawable UBOs
        for (const drawable of drawables) {
            if (!drawable.drawableUBO || (drawable.drawableUBO as any)._byteLength !== FILL_PATTERN_DRAWABLE_UBO_SIZE) {
                drawable.drawableUBO = new UniformBlock(FILL_PATTERN_DRAWABLE_UBO_SIZE);
            }
            drawable.drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

            // Compute pixel coordinates for this tile (for pattern position calc)
            const tileID = drawable.tileID!;
            const tileSize = transform.tileSize;
            const numTiles = Math.pow(2, tileID.overscaledZ);
            const tileSizeAtNearestZoom = tileSize * Math.pow(2, transform.tileZoom) / numTiles;
            const pixelX = tileSizeAtNearestZoom * (tileID.canonical.x + tileID.wrap * numTiles);
            const pixelY = tileSizeAtNearestZoom * tileID.canonical.y;

            const pixel_upper_x = (pixelX >> 16) & 0xFFFF;
            const pixel_upper_y = (pixelY >> 16) & 0xFFFF;
            const pixel_lower_x = pixelX & 0xFFFF;
            const pixel_lower_y = pixelY & 0xFFFF;

            drawable.drawableUBO.setVec2(64, pixel_upper_x, pixel_upper_y);     // pixel_coord_upper
            drawable.drawableUBO.setVec2(72, pixel_lower_x, pixel_lower_y);     // pixel_coord_lower

            // tile_ratio = 1 / pixelsToTileUnits, matching GL's patternUniformValues
            // pixelsToTileUnits(tile, 1, z) = tileSize / 2^(z - overscaledZ)
            const overscale = Math.pow(2, transform.tileZoom - tileID.overscaledZ);
            const pixelsToTileUnitsVal = tileSize / overscale;
            const tile_ratio = pixelsToTileUnitsVal === 0 ? 0 : 1 / pixelsToTileUnitsVal;
            drawable.drawableUBO.setFloat(80, tile_ratio);

            drawable.layerUBO = propsUBO;
        }
    }
}

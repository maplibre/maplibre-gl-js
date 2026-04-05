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

// LinePatternPropsUBO: 96 bytes (6 × vec4)
// color(16) + pattern_from(16) + pattern_to(16) + display_sizes(16) + scales_fade_opacity(16) + texsize_width(16)
const LINE_PATTERN_PROPS_UBO_SIZE = 96;
// LinePatternDrawableUBO: 128 bytes
// matrix(64) + ratio(4) + dpr(4) + units_to_pixels(8) + pixel_coord_upper(8) + pixel_coord_lower(8) + tile_ratio(4) + pad(12) + pad_vec4(16)
const LINE_PATTERN_DRAWABLE_UBO_SIZE = 128;

/**
 * Per-frame uniform updater for line layers.
 * Handles 5 shader variants: line, lineSDF, linePattern, lineGradient, lineGradientSDF.
 */
export class LineLayerTweaker extends LayerTweaker {

    constructor(layerId: string) {
        super(layerId);
    }

    _patternPropsUBOByKey: {[key: string]: UniformBlock} = {};

    execute(
        drawables: Drawable[],
        painter: Painter,
        layer: StyleLayer,
        _coords: Array<OverscaledTileID>
    ): void {
        const lineLayer = layer as LineStyleLayer;
        const transform = painter.transform;

        // Update evaluated props UBO — must run every frame for zoom-dependent properties
        if (!this.evaluatedPropsUBO || (this.evaluatedPropsUBO as any)._byteLength !== LINE_PROPS_UBO_SIZE) {
            this.evaluatedPropsUBO = new UniformBlock(LINE_PROPS_UBO_SIZE);
        }
        const propsUBO = this.evaluatedPropsUBO;
        const paint = lineLayer.paint;
        const evalParams = {zoom: transform.zoom};

        // Helper: get constant or evaluate zoom-dependent value
        const getFloat = (prop: string): number | null => {
            const val = paint.get(prop as any);
            if (typeof val === 'number') return val;
            if (val === null || val === undefined) return null;
            const c = val.constantOr(undefined);
            if (c !== undefined) return c as number;
            if (typeof (val as any).evaluate === 'function') {
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
            const isLinePattern = drawable.shaderName === 'linePattern';

            if (isLinePattern) {
                this._updateLinePatternDrawable(drawable, painter, lineLayer);
                continue;
            }

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
                const ptu = pixelsToTileUnits(tileProxy, 1, zoom);
                const ratio = pixelScale / ptu;
                drawable.drawableUBO.setFloat(64, ratio);
                drawable.drawableUBO.setFloat(68, painter.pixelRatio);
                drawable.drawableUBO.setVec2(72, 1 / transform.pixelsToGLUnits[0], 1 / transform.pixelsToGLUnits[1]);

            }

            // Share the layer-level UBO reference
            drawable.layerUBO = this.evaluatedPropsUBO;
        }
    }

    private _updateLinePatternDrawable(drawable: Drawable, painter: Painter, lineLayer: LineStyleLayer): void {
        const transform = painter.transform;
        const zoom = transform.zoom;
        const pixelScale = transform.getPixelScale();
        const patternData = (drawable as any)._patternData;
        if (!patternData || !drawable.tileID) return;

        const crossfade = lineLayer.getCrossfadeParameters();
        if (!crossfade) return;

        const paint = lineLayer.paint;

        // Drawable UBO (128 bytes)
        if (!drawable.drawableUBO || (drawable.drawableUBO as any)._byteLength !== LINE_PATTERN_DRAWABLE_UBO_SIZE) {
            drawable.drawableUBO = new UniformBlock(LINE_PATTERN_DRAWABLE_UBO_SIZE);
        }
        const drawableUBO = drawable.drawableUBO;
        drawableUBO.setMat4(0, drawable.projectionData.mainMatrix as Float32Array);

        const tileProxy = {tileID: drawable.tileID, tileSize: transform.tileSize};
        const ptu = pixelsToTileUnits(tileProxy, 1, zoom);
        const ratio = pixelScale / ptu;
        drawableUBO.setFloat(64, ratio);                                            // ratio
        drawableUBO.setFloat(68, painter.pixelRatio);                               // device_pixel_ratio
        drawableUBO.setVec2(72, 1 / transform.pixelsToGLUnits[0], 1 / transform.pixelsToGLUnits[1]);  // units_to_pixels

        // Pixel coords for pattern positioning
        const tileID = drawable.tileID;
        const tileSize = transform.tileSize;
        const numTiles = Math.pow(2, tileID.overscaledZ);
        const tileSizeAtNearestZoom = tileSize * Math.pow(2, transform.tileZoom) / numTiles;
        const pixelX = tileSizeAtNearestZoom * (tileID.canonical.x + tileID.wrap * numTiles);
        const pixelY = tileSizeAtNearestZoom * tileID.canonical.y;
        drawableUBO.setVec2(80, (pixelX >> 16) & 0xFFFF, (pixelY >> 16) & 0xFFFF);
        drawableUBO.setVec2(88, pixelX & 0xFFFF, pixelY & 0xFFFF);

        // tile_ratio using canonical.z (matches fill pattern)
        const overscale = Math.pow(2, transform.tileZoom - tileID.canonical.z);
        const pixelsToTileUnitsVal = 8192 / (tileSize * overscale);
        const tile_ratio = pixelsToTileUnitsVal === 0 ? 0 : 1 / pixelsToTileUnitsVal;
        drawableUBO.setFloat(96, tile_ratio);

        // Pattern props UBO (per-drawable since pattern data varies per tile)
        let patternPropsUBO = (drawable as any)._patternPropsUBO as UniformBlock;
        if (!patternPropsUBO || (patternPropsUBO as any)._byteLength !== LINE_PATTERN_PROPS_UBO_SIZE) {
            patternPropsUBO = new UniformBlock(LINE_PATTERN_PROPS_UBO_SIZE);
            (drawable as any)._patternPropsUBO = patternPropsUBO;
        }

        // Fetch paint values
        const color = (paint.get('line-color') as any).constantOr(null);
        const opacity = (paint.get('line-opacity') as any).constantOr(1.0);
        const blur = (paint.get('line-blur') as any).constantOr(0.0);
        const widthVal = (paint.get('line-width') as any).constantOr(1.0);

        const tlA = patternData.patternFrom.tl;
        const brA = patternData.patternFrom.br;
        const tlB = patternData.patternTo.tl;
        const brB = patternData.patternTo.br;
        const sizeA = patternData.patternFrom.displaySize;
        const sizeB = patternData.patternTo.displaySize;
        const texW = patternData.texsize[0];
        const texH = patternData.texsize[1];

        patternPropsUBO.setVec4(0, color?.r || 0, color?.g || 0, color?.b || 0, color?.a || 1);       // color
        patternPropsUBO.setVec4(16, tlA[0], tlA[1], brA[0], brA[1]);                                  // pattern_from
        patternPropsUBO.setVec4(32, tlB[0], tlB[1], brB[0], brB[1]);                                  // pattern_to
        patternPropsUBO.setVec4(48, sizeA[0], sizeA[1], sizeB[0], sizeB[1]);                          // display_sizes
        patternPropsUBO.setVec4(64, crossfade.fromScale, crossfade.toScale, crossfade.t, opacity);    // scales_fade_opacity
        patternPropsUBO.setVec4(80, texW, texH, widthVal, blur);                                      // texsize_width_blur

        drawable.layerUBO = patternPropsUBO;
    }
}

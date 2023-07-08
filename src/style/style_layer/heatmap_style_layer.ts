import {StyleLayer} from '../style_layer';

import {HeatmapBucket} from '../../data/bucket/heatmap_bucket';
import {RGBAImage} from '../../util/image';
import properties, {HeatmapPaintPropsPossiblyEvaluated} from './heatmap_style_layer_properties.g';
import {renderColorRamp} from '../../util/color_ramp';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';

import type {Texture} from '../../render/texture';
import type {Framebuffer} from '../../gl/framebuffer';
import type {HeatmapPaintProps} from './heatmap_style_layer_properties.g';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * A style layer that defines a heatmap
 */
export class HeatmapStyleLayer extends StyleLayer {

    heatmapFbo: Framebuffer;
    colorRamp: RGBAImage;
    colorRampTexture: Texture;

    _transitionablePaint: Transitionable<HeatmapPaintProps>;
    _transitioningPaint: Transitioning<HeatmapPaintProps>;
    paint: PossiblyEvaluated<HeatmapPaintProps, HeatmapPaintPropsPossiblyEvaluated>;

    createBucket(options: any) {
        return new HeatmapBucket(options);
    }

    constructor(layer: LayerSpecification) {
        super(layer, properties);

        // make sure color ramp texture is generated for default heatmap color too
        this._updateColorRamp();
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'heatmap-color') {
            this._updateColorRamp();
        }
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['heatmap-color'].value.expression;
        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'heatmapDensity',
            image: this.colorRamp
        });
        this.colorRampTexture = null;
    }

    resize() {
        if (this.heatmapFbo) {
            this.heatmapFbo.destroy();
            this.heatmapFbo = null;
        }
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean {
        return false;
    }

    hasOffscreenPass() {
        return this.paint.get('heatmap-opacity') !== 0 && this.visibility !== 'none';
    }
}

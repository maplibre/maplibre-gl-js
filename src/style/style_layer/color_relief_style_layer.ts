import {StyleLayer} from '../style_layer';

import properties, {type ColorReliefPaintPropsPossiblyEvaluated} from './color_relief_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {ColorReliefPaintProps} from './color_relief_style_layer_properties.g';
import {Color, Interpolate, ZoomConstantExpression, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Texture} from '../../render/texture';
import type {RGBAImage} from '../../util/image';
import {renderColorRamp} from '../../util/color_ramp';
import {nextPowerOfTwo} from '../../util/util';

export const isColorReliefStyleLayer = (layer: StyleLayer): layer is ColorReliefStyleLayer => layer.type === 'color-relief';

export class ColorReliefStyleLayer extends StyleLayer {
    colorRamp: RGBAImage;
    colorRampTexture: Texture;
    elevationRange: {start: number; end: number};
    elevationStops: Array<number>;
    colorStops: Array<Color>;
    _transitionablePaint: Transitionable<ColorReliefPaintProps>;
    _transitioningPaint: Transitioning<ColorReliefPaintProps>;
    paint: PossiblyEvaluated<ColorReliefPaintProps, ColorReliefPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);        this._updateColorRamp();
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['color-relief-color'].value.expression;
        if (expression instanceof ZoomConstantExpression && expression._styleExpression.expression instanceof Interpolate) {
            const interpolater = expression._styleExpression.expression;
            this.elevationRange = {start: interpolater.labels[0], end: interpolater.labels[interpolater.labels.length-1]};
            this.elevationStops = [];
            this.colorStops = [];
            for (const label of interpolater.labels) {
                this.elevationStops.push(label);
                this.colorStops.push(interpolater.evaluate({globals: { elevation: label }} as any))
            }
            const colormapLength = nextPowerOfTwo(this.elevationStops.length - 1) + 1;
            while (this.elevationStops.length < colormapLength) {
                this.elevationStops.push(this.elevationStops.at(-1));
                this.colorStops.push(this.colorStops.at(-1));
            }
            this.colorRamp = renderColorRamp({
                expression,
                evaluationKey: 'elevation',
                image: this.colorRamp,
                clips: [this.elevationRange]
            });
        } else{
            this.elevationRange = {start: 0, end: 1};
            this.colorRamp = null;
        }
        this.colorRampTexture = null;
    }

    hasOffscreenPass() {
        return this.visibility !== 'none' && !!this.colorRamp;
    }
}

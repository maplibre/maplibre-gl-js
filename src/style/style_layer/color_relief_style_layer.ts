import {StyleLayer} from '../style_layer';

import properties, {type ColorReliefPaintPropsPossiblyEvaluated} from './color_relief_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {ColorReliefPaintProps} from './color_relief_style_layer_properties.g';
import {type Color, Interpolate, ZoomConstantExpression, type LayerSpecification, type EvaluationContext} from '@maplibre/maplibre-gl-style-spec';
import {nextPowerOfTwo} from '../../util/util';

export const isColorReliefStyleLayer = (layer: StyleLayer): layer is ColorReliefStyleLayer => layer.type === 'color-relief';

export class ColorReliefStyleLayer extends StyleLayer {
    elevationStops: Array<number>;
    colorStops: Array<Color>;
    _transitionablePaint: Transitionable<ColorReliefPaintProps>;
    _transitioningPaint: Transitioning<ColorReliefPaintProps>;
    paint: PossiblyEvaluated<ColorReliefPaintProps, ColorReliefPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
        this._updateColorRamp();
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['color-relief-color'].value.expression;
        if (expression instanceof ZoomConstantExpression && expression._styleExpression.expression instanceof Interpolate) {
            const interpolater = expression._styleExpression.expression;
            this.elevationStops = interpolater.labels;
            this.colorStops = [];
            for (const label of this.elevationStops) {
                this.colorStops.push(interpolater.evaluate({globals: {elevation: label}} as EvaluationContext));
            }
        }
    }

    hasOffscreenPass() {
        return this.visibility !== 'none' && !!this.elevationStops;
    }
}

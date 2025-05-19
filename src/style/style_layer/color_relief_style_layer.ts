import {StyleLayer} from '../style_layer';

import properties, {type ColorReliefPaintPropsPossiblyEvaluated} from './color_relief_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {ColorReliefPaintProps} from './color_relief_style_layer_properties.g';
import {type Color, Interpolate, ZoomConstantExpression, type LayerSpecification, type EvaluationContext} from '@maplibre/maplibre-gl-style-spec';
import {warnOnce} from '../../util/util';

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
    
    // Get the color ramp, enforcing a maximum length for the vectors. This modifies the internal color ramp,
    // so that the remapping is only performed once.
    getColorRamp(maxLength: number) : {elevationStops: Array<number>; colorStops: Array<Color>} {
        if (this.elevationStops.length > maxLength) {
            const remapStepSize = (this.elevationStops.length - 1)/(maxLength - 1);
            const remappedElevationStops = [];
            const remappedColorStops = [];
            for (let i = 0; i < this.elevationStops.length - 0.5; i += remapStepSize) {
                remappedElevationStops.push(this.elevationStops[Math.round(i)]);
                remappedColorStops.push(this.colorStops[Math.round(i)]);
            }
            warnOnce(`Too many colors in specification of ${this.id} color-relief layer, may not render properly.`);
            this.elevationStops = remappedElevationStops;
            this.colorStops = remappedColorStops;
        }
        return {elevationStops: this.elevationStops, colorStops: this.colorStops};
    }

    hasOffscreenPass() {
        return this.visibility !== 'none' && !!this.elevationStops;
    }
}

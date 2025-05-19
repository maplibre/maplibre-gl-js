import {StyleLayer} from '../style_layer';

import properties, {type ColorReliefPaintPropsPossiblyEvaluated} from './color_relief_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {ColorReliefPaintProps} from './color_relief_style_layer_properties.g';
import {Color, Interpolate, ZoomConstantExpression, type LayerSpecification, type EvaluationContext} from '@maplibre/maplibre-gl-style-spec';
import {warnOnce} from '../../util/util';

export const isColorReliefStyleLayer = (layer: StyleLayer): layer is ColorReliefStyleLayer => layer.type === 'color-relief';

export type ColorRamp = {elevationStops: Array<number>; colorStops: Array<Color>};

export class ColorReliefStyleLayer extends StyleLayer {
    colorRamp: ColorRamp;
    _transitionablePaint: Transitionable<ColorReliefPaintProps>;
    _transitioningPaint: Transitioning<ColorReliefPaintProps>;
    paint: PossiblyEvaluated<ColorReliefPaintProps, ColorReliefPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
        this.colorRamp = this._updateColorRamp();
    }

    _updateColorRamp() : ColorRamp {
        const colorRamp = {elevationStops: [], colorStops: []} as ColorRamp;
        const expression = this._transitionablePaint._values['color-relief-color'].value.expression;
        if (expression instanceof ZoomConstantExpression && expression._styleExpression.expression instanceof Interpolate) {
            const interpolater = expression._styleExpression.expression;
            colorRamp.elevationStops = interpolater.labels;
            colorRamp.colorStops = [];
            for (const label of colorRamp.elevationStops) {
                colorRamp.colorStops.push(interpolater.evaluate({globals: {elevation: label}} as EvaluationContext));
            }
        }
        if (colorRamp.elevationStops.length < 1)
        {
            colorRamp.elevationStops = [0];
            colorRamp.colorStops = [Color.transparent];
        }
        if (colorRamp.elevationStops.length < 2)
        {
            colorRamp.elevationStops.push(colorRamp.elevationStops[0] + 1);
            colorRamp.colorStops.push(colorRamp.colorStops[0]);
        }
        return colorRamp;
    }
    
    // Get the color ramp, enforcing a maximum length for the vectors. This modifies the internal color ramp,
    // so that the remapping is only performed once.
    getColorRamp(maxLength: number) : {elevationStops: Array<number>; colorStops: Array<Color>} {
        if (this.colorRamp.elevationStops.length > maxLength) {
            const remapStepSize = (this.colorRamp.elevationStops.length - 1)/(maxLength - 1);
            const remappedElevationStops = [];
            const remappedColorStops = [];
            for (let i = 0; i < this.colorRamp.elevationStops.length - 0.5; i += remapStepSize) {
                remappedElevationStops.push(this.colorRamp.elevationStops[Math.round(i)]);
                remappedColorStops.push(this.colorRamp.colorStops[Math.round(i)]);
            }
            warnOnce(`Too many colors in specification of ${this.id} color-relief layer, may not render properly.`);
            this.colorRamp.elevationStops = remappedElevationStops;
            this.colorRamp.colorStops = remappedColorStops;
        }
        return this.colorRamp;
    }

    hasOffscreenPass() {
        return this.visibility !== 'none' && !!this.colorRamp;
    }
}

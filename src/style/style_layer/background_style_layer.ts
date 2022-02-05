import StyleLayer from '../style_layer';

import properties, {BackgroundPaintPropsPossiblyEvaluated} from './background_style_layer_properties.g';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';

import type {BackgroundPaintProps} from './background_style_layer_properties.g';
import type {LayerSpecification} from '../../style-spec/types';

class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<BackgroundPaintProps>;
    _transitioningPaint: Transitioning<BackgroundPaintProps>;
    paint: PossiblyEvaluated<BackgroundPaintProps, BackgroundPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

export default BackgroundStyleLayer;

import {StyleLayer} from '../style_layer.ts';

import properties, {BackgroundPaintPropsPossiblyEvaluated} from './background_style_layer_properties.g.ts';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.ts';

import type {BackgroundPaintProps} from './background_style_layer_properties.g.ts';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export class BackgroundStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<BackgroundPaintProps>;
    _transitioningPaint: Transitioning<BackgroundPaintProps>;
    paint: PossiblyEvaluated<BackgroundPaintProps, BackgroundPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

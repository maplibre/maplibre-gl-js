import {StyleLayer} from '../style_layer';

import properties, {HillshadePaintPropsPossiblyEvaluated} from './hillshade_style_layer_properties.g';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';

import type {HillshadePaintProps} from './hillshade_style_layer_properties.g';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export class HillshadeStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<HillshadePaintProps>;
    _transitioningPaint: Transitioning<HillshadePaintProps>;
    paint: PossiblyEvaluated<HillshadePaintProps, HillshadePaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    hasOffscreenPass() {
        return this.paint.get('hillshade-exaggeration') !== 0 && this.visibility !== 'none';
    }
}

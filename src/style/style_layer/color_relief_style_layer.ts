import {StyleLayer} from '../style_layer';

import properties, {type ColorReliefPaintPropsPossiblyEvaluated} from './color_relief_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {ColorReliefPaintProps} from './color_relief_style_layer_properties.g';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export const isColorReliefStyleLayer = (layer: StyleLayer): layer is ColorReliefStyleLayer => layer.type === 'color-relief';

export class ColorReliefStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<ColorReliefPaintProps>;
    _transitioningPaint: Transitioning<ColorReliefPaintProps>;
    paint: PossiblyEvaluated<ColorReliefPaintProps, ColorReliefPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    hasOffscreenPass() {
        return this.visibility !== 'none';
    }
}

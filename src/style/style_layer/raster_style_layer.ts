import {StyleLayer} from '../style_layer.ts';

import properties, {RasterPaintPropsPossiblyEvaluated} from './raster_style_layer_properties.g.ts';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.ts';

import type {RasterPaintProps} from './raster_style_layer_properties.g.ts';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<RasterPaintProps>;
    _transitioningPaint: Transitioning<RasterPaintProps>;
    paint: PossiblyEvaluated<RasterPaintProps, RasterPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

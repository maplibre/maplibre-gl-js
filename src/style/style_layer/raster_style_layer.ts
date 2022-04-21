import StyleLayer from '../style_layer';

import properties, {RasterPaintPropsPossiblyEvaluated} from './raster_style_layer_properties.g';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';

import type {RasterPaintProps} from './raster_style_layer_properties.g';
import type {LayerSpecification} from '../../style-spec/types.g';

class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<RasterPaintProps>;
    _transitioningPaint: Transitioning<RasterPaintProps>;
    paint: PossiblyEvaluated<RasterPaintProps, RasterPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }
}

export default RasterStyleLayer;

import {StyleLayer} from '../style_layer.ts';

import properties, {type RasterPaintPropsPossiblyEvaluated} from './raster_style_layer_properties.g.ts';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties.ts';

import type {RasterPaintProps} from './raster_style_layer_properties.g.ts';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export const isRasterStyleLayer = (layer: StyleLayer): layer is RasterStyleLayer => layer.type === 'raster';

export class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<RasterPaintProps>;
    _transitioningPaint: Transitioning<RasterPaintProps>;
    paint: PossiblyEvaluated<RasterPaintProps, RasterPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
    }
}

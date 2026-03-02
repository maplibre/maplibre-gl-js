import {StyleLayer} from '../style_layer';

import properties, {type RasterPaintPropsPossiblyEvaluated} from './raster_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {RasterPaintProps} from './raster_style_layer_properties.g';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type StyleSetterOptions} from '../style';

export const isRasterStyleLayer = (layer: StyleLayer): layer is RasterStyleLayer => layer.type === 'raster';

export class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<RasterPaintProps>;
    _transitioningPaint: Transitioning<RasterPaintProps>;
    paint: PossiblyEvaluated<RasterPaintProps, RasterPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        let resampling = layer.paint?.['resampling'];
        let rasterResampling = layer.paint?.['raster-resampling'];
        if (resampling || rasterResampling) {
            if (resampling && rasterResampling) {
                console.warn(`Raster layer paint properties "resampling" and "raster-resampling" are both specified, but only "resampling" needs to be specified. Defaulting to "resampling" (${resampling}).`);
            }
            if (resampling) {
                rasterResampling = resampling;
            } else {
                resampling = rasterResampling;
            }
            layer.paint = {
                ...layer.paint,
                resampling: resampling,
                'raster-resampling': rasterResampling,
            };
        }
        super(layer, properties, globalState);
    }

    override setPaintProperty(name: string, value: unknown, options: StyleSetterOptions = {}): boolean {
        if (name === 'resampling') {
            super.setPaintProperty('raster-resampling', value);
        } else if (name === 'raster-resampling') {
            super.setPaintProperty('resampling', value);
        }
        return super.setPaintProperty(name, value, options);
    }
}

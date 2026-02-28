import {StyleLayer} from '../style_layer';

import properties, {type RasterPaintPropsPossiblyEvaluated} from './raster_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {RasterPaintProps} from './raster_style_layer_properties.g';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type StyleSetterOptions} from '../style';

export const isRasterStyleLayer = (layer: StyleLayer): layer is RasterStyleLayer => layer.type === 'raster';

interface Resamplings {
    resampling: RasterPaintPropsPossiblyEvaluated['resampling'];
    'raster-resampling': RasterPaintPropsPossiblyEvaluated['raster-resampling'];
}

function _handleResampling(resamplings: Partial<Resamplings>): Partial<Resamplings> {
    let resampling = resamplings.resampling;
    let rasterResampling = resamplings['raster-resampling'];
    if (resampling === undefined && rasterResampling === undefined) return {};
    if (resampling && rasterResampling) {
        console.warn('Raster layer paint properties "resampling" and "raster-resampling" are both specified, but only "resampling" needs to be specified.');
        if (resampling !== rasterResampling) {
            console.warn(`Value of "resampling" ('${resampling}') is different than that of "raster-resampling" ('${rasterResampling}'); defaulting to "resampling".`);
            rasterResampling = resampling;
        }
    } else {
        if (resampling) {
            rasterResampling = resampling;
        } else {
            resampling = rasterResampling;
        }
    }
    return {resampling, 'raster-resampling': rasterResampling};
}

export class RasterStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<RasterPaintProps>;
    _transitioningPaint: Transitioning<RasterPaintProps>;
    paint: PossiblyEvaluated<RasterPaintProps, RasterPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        const resampling = layer.paint?.['resampling'];
        const rasterResampling = layer.paint?.['raster-resampling'];
        if (resampling || rasterResampling) {
            layer.paint = {
                ...layer.paint,
                ..._handleResampling({
                    ...(resampling ? {resampling} : {}),
                    ...(rasterResampling ? {'raster-resampling': rasterResampling} : {}),
                }),
            };
        }
        super(layer, properties, globalState);
    }

    override setPaintProperty(name: string, value: unknown, options: StyleSetterOptions = {}): boolean {
        if (name === 'resampling' || name === 'raster-resampling') {
            const otherResampling = name === 'resampling' ? 'raster-resampling' : 'resampling';
            const handledResamplings = _handleResampling({[name]: value});
            if (handledResamplings?.[otherResampling]) {
                super.setPaintProperty(otherResampling, handledResamplings[otherResampling], options);
            }
        }
        return super.setPaintProperty(name, value, options);
    }
}

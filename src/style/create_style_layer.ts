import {HillshadeStyleLayer} from './style_layer/hillshade_style_layer.ts';
import {ColorReliefStyleLayer} from './style_layer/color_relief_style_layer.ts';
import {BackgroundStyleLayer} from './style_layer/background_style_layer.ts';
import {RasterStyleLayer} from './style_layer/raster_style_layer.ts';
import {CustomStyleLayer, type CustomLayerInterface} from './style_layer/custom_style_layer.ts';
import {createWorkerStyleLayer, type WorkerStyleLayer} from './create_worker_style_layer.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export type AnyStyleLayer =
    | WorkerStyleLayer
    | HillshadeStyleLayer
    | ColorReliefStyleLayer
    | BackgroundStyleLayer
    | RasterStyleLayer
    | CustomStyleLayer;

export function createStyleLayer(layer: LayerSpecification | CustomLayerInterface, globalState: Record<string, any>): AnyStyleLayer {
    if (layer.type === 'custom') {
        return new CustomStyleLayer(layer, globalState);
    }
    switch (layer.type) {
        case 'background':
            return new BackgroundStyleLayer(layer, globalState);
        case 'color-relief':
            return new ColorReliefStyleLayer(layer, globalState);
        case 'hillshade':
            return new HillshadeStyleLayer(layer, globalState);
        case 'raster':
            return new RasterStyleLayer(layer, globalState);
        default:
            return createWorkerStyleLayer(layer, globalState);
    }
}


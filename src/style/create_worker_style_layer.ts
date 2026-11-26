import {CircleStyleLayer} from './style_layer/circle_style_layer.ts';
import {FillStyleLayer} from './style_layer/fill_style_layer.ts';
import {FillExtrusionStyleLayer} from './style_layer/fill_extrusion_style_layer.ts';
import {HeatmapStyleLayer} from './style_layer/heatmap_style_layer.ts';
import {LineStyleLayer} from './style_layer/line_style_layer.ts';
import {SymbolStyleLayer} from './style_layer/symbol_style_layer.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export type WorkerStyleLayer =
    | CircleStyleLayer
    | FillStyleLayer
    | FillExtrusionStyleLayer
    | HeatmapStyleLayer
    | LineStyleLayer
    | SymbolStyleLayer;

/**
 * Instantiates a style layer for a bucket-producing layer type, or returns `null` for layer types
 * that do not produce vector tile buckets.
 */
export function createWorkerStyleLayer(layer: LayerSpecification, globalState: Record<string, any>): WorkerStyleLayer | null {
    switch (layer.type) {
        case 'circle':
            return new CircleStyleLayer(layer, globalState);
        case 'fill':
            return new FillStyleLayer(layer, globalState);
        case 'fill-extrusion':
            return new FillExtrusionStyleLayer(layer, globalState);
        case 'heatmap':
            return new HeatmapStyleLayer(layer, globalState);
        case 'line':
            return new LineStyleLayer(layer, globalState);
        case 'symbol':
            return new SymbolStyleLayer(layer, globalState);
        default:
            return null;
    }
}

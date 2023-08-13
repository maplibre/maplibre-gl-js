import {CircleStyleLayer} from './style_layer/circle_style_layer';
import {HeatmapStyleLayer} from './style_layer/heatmap_style_layer';
import {HillshadeStyleLayer} from './style_layer/hillshade_style_layer';
import {FillStyleLayer} from './style_layer/fill_style_layer';
import {FillExtrusionStyleLayer} from './style_layer/fill_extrusion_style_layer';
import {LineStyleLayer} from './style_layer/line_style_layer';
import {SymbolStyleLayer} from './style_layer/symbol_style_layer';
import {BackgroundStyleLayer} from './style_layer/background_style_layer';
import {RasterStyleLayer} from './style_layer/raster_style_layer';
import {CustomStyleLayer, type CustomLayerInterface} from './style_layer/custom_style_layer';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export function createStyleLayer(layer: LayerSpecification | CustomLayerInterface) {
    if (layer.type === 'custom') {
        return new CustomStyleLayer(layer);
    }
    switch (layer.type) {
        case 'background':
            return new BackgroundStyleLayer(layer);
        case 'circle':
            return new CircleStyleLayer(layer);
        case 'fill':
            return new FillStyleLayer(layer);
        case 'fill-extrusion':
            return new FillExtrusionStyleLayer(layer);
        case 'heatmap':
            return new HeatmapStyleLayer(layer);
        case 'hillshade':
            return new HillshadeStyleLayer(layer);
        case 'line':
            return new LineStyleLayer(layer);
        case 'raster':
            return new RasterStyleLayer(layer);
        case 'symbol':
            return new SymbolStyleLayer(layer);
    }
}


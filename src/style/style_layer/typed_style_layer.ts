import type {CircleStyleLayer} from './circle_style_layer.ts';
import type {FillStyleLayer} from './fill_style_layer.ts';
import type {FillExtrusionStyleLayer} from './fill_extrusion_style_layer.ts';
import type {HeatmapStyleLayer} from './heatmap_style_layer.ts';
import type {HillshadeStyleLayer} from './hillshade_style_layer.ts';
import type {LineStyleLayer} from './line_style_layer.ts';
import type {SymbolStyleLayer} from './symbol_style_layer.ts';

export type TypedStyleLayer = CircleStyleLayer | FillStyleLayer | FillExtrusionStyleLayer | HeatmapStyleLayer | HillshadeStyleLayer | LineStyleLayer | SymbolStyleLayer;

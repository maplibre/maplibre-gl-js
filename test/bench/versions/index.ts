import locationsWithTileID from '../lib/locations_with_tile_id';
import styleBenchmarkLocations from '../data/style-benchmark-locations.json' with {type: 'json'};
import Layout from '../benchmarks/layout';
import Placement from '../benchmarks/placement';
import SymbolLayout from '../benchmarks/symbol_layout';
import WorkerTransfer from '../benchmarks/worker_transfer';
import Paint from '../benchmarks/paint';
import PaintStates from '../benchmarks/paint_states';
import {PropertyLevelRemove, FeatureLevelRemove, SourceLevelRemove} from '../benchmarks/remove_paint_state';
import {LayerBackground, LayerCircle, LayerFill, LayerFillExtrusion, LayerHeatmap, LayerHillshade, LayerColorRelief2Colors, LayerColorRelief256Colors, LayerLine, LayerRaster, LayerSymbol, LayerSymbolWithIcons, LayerTextWithVariableAnchor, LayerSymbolWithSortKey} from '../benchmarks/layers';
import Load from '../benchmarks/map_load';
import HillshadeLoad from '../benchmarks/hillshade_load';
import ColorReliefLoad from '../benchmarks/color_relief_load';
import Validate from '../benchmarks/style_validate';
import StyleLayerCreate from '../benchmarks/style_layer_create';
import QueryPoint from '../benchmarks/query_point';
import QueryBox from '../benchmarks/query_box';
import {FunctionCreate, FunctionEvaluate, ExpressionCreate, ExpressionEvaluate} from '../benchmarks/expressions';
import FilterCreate from '../benchmarks/filter_create';
import FilterEvaluate from '../benchmarks/filter_evaluate';
import CustomLayer from '../benchmarks/customlayer';
import MapIdle from '../benchmarks/map_idle';

import {getGlobalWorkerPool} from '../../../src/util/global_worker_pool';
import SymbolCollisionBox from '../benchmarks/symbol_collision_box';
import Subdivide from '../benchmarks/subdivide';
import LoadMatchingFeature from '../benchmarks/feature_index';
import CoveringTilesGlobe from '../benchmarks/covering_tiles_globe';
import CoveringTilesMercator from '../benchmarks/covering_tiles_mercator';
import GeoJSONSourceUpdateData from '../benchmarks/geojson_source_update_data';
import GeoJSONSourceSetData from '../benchmarks/geojson_source_set_data';

const styleLocations = locationsWithTileID(styleBenchmarkLocations.features  as GeoJSON.Feature<GeoJSON.Point>[]).filter(v => v.zoom < 15); // the used maptiler sources have a maxzoom of 14

(window as any).maplibreglBenchmarks = (window as any).maplibreglBenchmarks || {};

const version = process.env.BENCHMARK_VERSION;

function register(name, bench) {
    (window as any).maplibreglBenchmarks[name] = (window as any).maplibreglBenchmarks[name] || {};
    (window as any).maplibreglBenchmarks[name][version] = bench;
}

const style = 'https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL';
const center = [-77.032194, 38.912753];
const zooms = [4, 8, 11, 13, 15, 17];
const locations = zooms.map(zoom => ({center, zoom}));

register('Paint', new Paint(style, locations));
register('QueryPoint', new QueryPoint(style, locations));
register('QueryBox', new QueryBox(style, locations));
register('GeoJSONSourceUpdateData', new GeoJSONSourceUpdateData());
register('GeoJSONSourceSetData', new GeoJSONSourceSetData());
register('Layout', new Layout(style));
register('Placement', new Placement(style, locations));
register('Validate', new Validate(style));
register('StyleLayerCreate', new StyleLayerCreate(style));
register('FunctionCreate', new FunctionCreate(style));
register('FunctionEvaluate', new FunctionEvaluate(style));
register('ExpressionCreate', new ExpressionCreate(style));
register('ExpressionEvaluate', new ExpressionEvaluate(style));
register('WorkerTransfer', new WorkerTransfer(style));
register('PaintStates', new PaintStates(center));
register('PropertyLevelRemove', new PropertyLevelRemove(center));
register('FeatureLevelRemove', new FeatureLevelRemove(center));
register('SourceLevelRemove', new SourceLevelRemove(center));
register('LayerBackground', new LayerBackground());
register('LayerCircle', new LayerCircle());
register('LayerFill', new LayerFill());
register('LayerFillExtrusion', new LayerFillExtrusion());
register('LayerHeatmap', new LayerHeatmap());
register('LayerHillshade', new LayerHillshade());
register('LayerColorRelief2Colors', new LayerColorRelief2Colors());
register('LayerColorRelief256Colors', new LayerColorRelief256Colors());
register('LayerLine', new LayerLine());
register('LayerRaster', new LayerRaster());
register('LayerSymbol', new LayerSymbol());
register('LayerSymbolWithIcons', new LayerSymbolWithIcons());
register('LayerTextWithVariableAnchor', new LayerTextWithVariableAnchor());
register('LayerSymbolWithSortKey', new LayerSymbolWithSortKey());
register('Load', new Load());
register('LoadMatchingFeature', new LoadMatchingFeature());
register('SymbolLayout', new SymbolLayout(style, styleLocations.map(location => location.tileID[0])));
register('FilterCreate', new FilterCreate());
register('FilterEvaluate', new FilterEvaluate());
register('HillshadeLoad', new HillshadeLoad());
register('ColorReliefLoad', new ColorReliefLoad());
register('CustomLayer', new CustomLayer());
register('MapIdle', new MapIdle());
register('SymbolCollisionBox', new SymbolCollisionBox(false));
register('SymbolCollisionBoxGlobe', new SymbolCollisionBox(true));
register('Subdivide', new Subdivide());
register('CoveringTilesGlobe', new CoveringTilesGlobe(0));
register('CoveringTilesGlobePitched', new CoveringTilesGlobe(60));
register('CoveringTilesMercator', new CoveringTilesMercator(0));
register('CoveringTilesMercatorPitched', new CoveringTilesMercator(60));

Promise.resolve().then(() => {
    // Ensure the global worker pool is never drained. Browsers have resource limits
    // on the max number of workers that can be created per page.
    // We do this async to avoid creating workers before the worker bundle blob
    // URL has been set up, which happens after this module is executed.
    getGlobalWorkerPool().acquire(-1);
});

export * from '../../../src';

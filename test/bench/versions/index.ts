import locationsWithTileID from '../lib/locations_with_tile_id.ts';
import styleBenchmarkLocations from '../data/style-benchmark-locations.json' with {type: 'json'};
import Layout from '../benchmarks/layout.ts';
import Placement from '../benchmarks/placement.ts';
import SymbolLayout from '../benchmarks/symbol_layout.ts';
import WorkerTransfer from '../benchmarks/worker_transfer.ts';
import Paint from '../benchmarks/paint.ts';
import PaintStates from '../benchmarks/paint_states.ts';
import {PropertyLevelRemove, FeatureLevelRemove, SourceLevelRemove} from '../benchmarks/remove_paint_state.ts';
import {LayerBackground, LayerCircle, LayerFill, LayerFillExtrusion, LayerHeatmap, LayerHillshade, LayerColorRelief2Colors, LayerColorRelief256Colors, LayerLine, LayerRaster, LayerSymbol, LayerSymbolWithHalo, LayerSymbolWithIcons, LayerTextWithVariableAnchor, LayerSymbolWithSortKey} from '../benchmarks/layers.ts';
import Load from '../benchmarks/map_load.ts';
import HillshadeLoad from '../benchmarks/hillshade_load.ts';
import ColorReliefLoad from '../benchmarks/color_relief_load.ts';
import Validate from '../benchmarks/style_validate.ts';
import StyleLayerCreate from '../benchmarks/style_layer_create.ts';
import QueryPoint from '../benchmarks/query_point.ts';
import QueryBox from '../benchmarks/query_box.ts';
import {FunctionCreate, FunctionEvaluate, ExpressionCreate, ExpressionEvaluate} from '../benchmarks/expressions.ts';
import FilterCreate from '../benchmarks/filter_create.ts';
import FilterEvaluate from '../benchmarks/filter_evaluate.ts';
import CustomLayer from '../benchmarks/customlayer.ts';
import MapIdle from '../benchmarks/map_idle.ts';

import {getGlobalWorkerPool} from '../../../src/util/global_worker_pool.ts';
import {setWorkerUrl} from '../../../src/index.ts';
import SymbolCollisionBox from '../benchmarks/symbol_collision_box.ts';
import Subdivide from '../benchmarks/subdivide.ts';
import LoadMatchingFeature from '../benchmarks/feature_index.ts';
import CoveringTilesGlobe from '../benchmarks/covering_tiles_globe.ts';
import CoveringTilesMercator from '../benchmarks/covering_tiles_mercator.ts';
import GeoJSONSourceUpdateData from '../benchmarks/geojson_source_update_data.ts';
import GeoJSONSourceSetData from '../benchmarks/geojson_source_set_data.ts';
import {Terrain3DGlobe, Terrain3DMercator, Terrain2DGlobe, Terrain2DMercator} from '../benchmarks/terrain.ts';

const styleLocations = locationsWithTileID(styleBenchmarkLocations.features  as Array<GeoJSON.Feature<GeoJSON.Point>>).filter(v => v.zoom < 15); // the used maptiler sources have a maxzoom of 14

(window as any).maplibreglBenchmarks = (window as any).maplibreglBenchmarks || {};

// Resolve the worker URL relative to this bundle's own URL (set by rollup ESM output).
setWorkerUrl(new URL('./benchmarks_worker.mjs', import.meta.url).toString());

const version = process.env.BENCHMARK_VERSION;

function register(name, bench) {
    (window as any).maplibreglBenchmarks[name] = (window as any).maplibreglBenchmarks[name] || {};
    (window as any).maplibreglBenchmarks[name][version] = bench;
}

const style = 'https://tiles.openfreemap.org/styles/liberty';
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
register('LayerSymbolWithHalo', new LayerSymbolWithHalo());
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
register('Terrain3DGlobe', new Terrain3DGlobe());
register('Terrain3DMercator', new Terrain3DMercator());
register('Terrain2DGlobe', new Terrain2DGlobe());
register('Terrain2DMercator', new Terrain2DMercator());

Promise.resolve().then(() => {
    // Ensure the global worker pool is never drained. Browsers have resource limits
    // on the max number of workers that can be created per page.
    // We do this async to avoid creating workers before the worker bundle blob
    // URL has been set up, which happens after this module is executed.
    getGlobalWorkerPool().acquire(-1);
});

export * from '../../../src/index.ts';

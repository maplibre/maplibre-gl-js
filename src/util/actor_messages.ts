import type {LoadGeoJSONParameters} from '../source/geojson_worker_source';
import type {TileParameters, WorkerDEMTileParameters, WorkerTileParameters, WorkerTileResult} from '../source/worker_source';
import type {DEMData} from '../data/dem_data';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type {PluginState} from '../source/rtl_text_plugin';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {OverscaledTileID} from '../source/tile_id';
import type {RequestParameters} from './ajax';

export type MessageType = '<response>' | '<cancel>' |
'geojson.getClusterExpansionZoom' | 'geojson.getClusterChildren' | 'geojson.getClusterLeaves' | 'geojson.loadData' |
'removeSource' | 'loadWorkerSource' | 'loadDEMTile' | 'removeDEMTile' |
'removeTile' | 'reloadTile' | 'abortTile' | 'loadTile' |
'getGlyphs' | 'getImages' | 'setImages' | 'getResource' |
'syncRTLPluginState' | 'setReferrer' | 'setLayers' | 'updateLayers';

export type AsyncMessage<T extends MessageType> = {
    type: T;
    data: RequestObjectMap[T];
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    sourceMapId?: string | number | null;
};

export type ClusterIDAndSource = {
    clusterId: number;
    source: string;
};

export type GetClusterLeavesParams = ClusterIDAndSource & { limit: number; offset: number };

export type GeoJSONWorkerSourceLoadDataResult = {
    resourceTiming?: {[_: string]: Array<PerformanceResourceTiming>};
    abandoned?: boolean;
};

export type RemoveSourceParams = {
    source: string;
    type: string;
}

export type UpdateLayersParamaeters = {
    layers: Array<LayerSpecification>;
    removedIds: Array<string>;
}

export type GetImagesParamerters = {
    icons: Array<string>;
    source: string;
    tileID: OverscaledTileID;
    type: string;
}

export type RequestObjectMap = {
    'loadDEMTile': WorkerDEMTileParameters;
    'geojson.getClusterExpansionZoom': ClusterIDAndSource;
    'geojson.getClusterChildren': ClusterIDAndSource;
    'geojson.getClusterLeaves': GetClusterLeavesParams;
    'geojson.loadData': LoadGeoJSONParameters;
    'loadTile': WorkerTileParameters;
    'reloadTile': WorkerTileParameters;
    'getGlyphs': void;
    'getImages': GetImagesParamerters;
    'setImages': string[];
    'setLayers': Array<LayerSpecification>;
    'updateLayers': UpdateLayersParamaeters;
    'syncRTLPluginState': PluginState;
    'setReferrer': string;
    'removeSource': RemoveSourceParams;
    'loadWorkerSource': string;
    'removeTile': TileParameters;
    'abortTile': TileParameters;
    'removeDEMTile': TileParameters;
    'getResource': RequestParameters;
    'error': void;
    '<cancel>': void;
    '<response>': void;
}

export type ResponseObjectMap = {
    'loadDEMTile': DEMData;
    'geojson.getClusterExpansionZoom': number;
    'geojson.getClusterChildren': Array<GeoJSON.Feature>;
    'geojson.getClusterLeaves': Array<GeoJSON.Feature>;
    'geojson.loadData': GeoJSONWorkerSourceLoadDataResult;
    'loadTile': WorkerTileResult;
    'reloadTile': WorkerTileResult;
    'getGlyphs': {[_: string]: {[_: number]: StyleGlyph}};
    'getImages': {[_: string]: StyleImage};
    'setImages': void;
    'setLayers': void;
    'updateLayers': void;
    'syncRTLPluginState': boolean;
    'setReferrer': void;
    'removeSource': void;
    'loadWorkerSource': void;
    'removeTile': void;
    'abortTile': void;
    'removeDEMTile': void;
    'getResource': any;
    'error': Error;
    '<cancel>': void;
    '<response>': void;
}

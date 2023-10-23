import type {LoadGeoJSONParameters} from '../source/geojson_worker_source';
import type {TileParameters, WorkerDEMTileParameters, WorkerTileParameters, WorkerTileResult} from '../source/worker_source';
import type {DEMData} from '../data/dem_data';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type {PluginState} from '../source/rtl_text_plugin';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {OverscaledTileID} from '../source/tile_id';
import type {RequestParameters} from './ajax';

export type MessageType = 'getClusterExpansionZoom' | 'getClusterChildren' | 'getClusterLeaves' | 'loadData' |
'removeSource' | 'loadWorkerSource' | 'loadDEMTile' | 'removeDEMTile' |
'removeTile' | 'reloadTile' | 'abortTile' | 'loadTile' |
'getGlyphs' | 'getImages' | 'setImages' | 'getResource' |
'syncRTLPluginState' | 'setReferrer' | 'setLayers' | 'updateLayers';

export type AsyncMessage<T extends MessageType> = {
    type: T;
    data: RequestResponseMessageMap[T][0];
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    sourceMapId?: string | number | null;
};

export type ClusterIDAndSource = {
    type: 'geojson';
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

export type GetGlyhsParamerters = {
    type: string;
    stacks: {[_: string]: Array<number>};
    source: string;
    tileID: OverscaledTileID;
}

export type RequestResponseMessageMap = {
    'loadDEMTile': [WorkerDEMTileParameters, DEMData];
    'getClusterExpansionZoom': [ClusterIDAndSource, number];
    'getClusterChildren': [ClusterIDAndSource, Array<GeoJSON.Feature>];
    'getClusterLeaves': [GetClusterLeavesParams, Array<GeoJSON.Feature>];
    'loadData': [LoadGeoJSONParameters, GeoJSONWorkerSourceLoadDataResult];
    'loadTile': [WorkerTileParameters, WorkerTileResult];
    'reloadTile': [WorkerTileParameters, WorkerTileResult];
    'getGlyphs': [GetGlyhsParamerters, {[_: string]: {[_: number]: StyleGlyph}}];
    'getImages': [GetImagesParamerters, {[_: string]: StyleImage}];
    'setImages': [string[], void];
    'setLayers': [Array<LayerSpecification>, void];
    'updateLayers': [UpdateLayersParamaeters, void];
    'syncRTLPluginState': [PluginState, boolean];
    'setReferrer': [string, void];
    'removeSource': [RemoveSourceParams, void];
    'loadWorkerSource': [string, void];
    'removeTile': [TileParameters, void];
    'abortTile': [TileParameters, void];
    'removeDEMTile': [TileParameters, void];
    'getResource': [RequestParameters, any];
}

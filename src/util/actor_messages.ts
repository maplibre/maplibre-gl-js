import type {LoadGeoJSONParameters} from '../source/geojson_worker_source';
import type {TileParameters, WorkerDEMTileParameters, WorkerTileParameters, WorkerTileResult} from '../source/worker_source';
import type {DEMData} from '../data/dem_data';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type {PluginState} from '../source/rtl_text_plugin_status';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {OverscaledTileID} from '../source/tile_id';
import type {GetResourceResponse, RequestParameters} from './ajax';

/**
 * The parameters needed in order to get information about the cluster
 */
export type ClusterIDAndSource = {
    type: 'geojson';
    clusterId: number;
    source: string;
};

/**
 * Parameters needed to get the leaves of a cluster
 */
export type GetClusterLeavesParams = ClusterIDAndSource & { limit: number; offset: number };

/**
 * The result of the call to load a geojson source
 */
export type GeoJSONWorkerSourceLoadDataResult = {
    resourceTiming?: {[_: string]: Array<PerformanceResourceTiming>};
    abandoned?: boolean;
};

/**
 * Parameters needed to remove a source
 */
export type RemoveSourceParams = {
    source: string;
    type: string;
}

/**
 * Parameters needed to update the layers
 */
export type UpdateLayersParamaeters = {
    layers: Array<LayerSpecification>;
    removedIds: Array<string>;
}

/**
 * Parameters needed to get the images
 */
export type GetImagesParamerters = {
    icons: Array<string>;
    source: string;
    tileID: OverscaledTileID;
    type: string;
}

/**
 * Parameters needed to get the glyphs
 */
export type GetGlyphsParamerters = {
    type: string;
    stacks: {[_: string]: Array<number>};
    source: string;
    tileID: OverscaledTileID;
}

/**
 * A response object returned when requesting glyphs
 */
export type GetGlyphsResponse = {
    [stack: string]: {
        [id: number]: StyleGlyph;
    };
}

/**
 * A response object returned when requesting images
 */
export type GetImagesResponse = {[_: string]: StyleImage}

/**
 * This is basically a mapping between all the calls that are made to and from the workers.
 * The key is the event name, the first parameter is the event input type, and the last parameter is the output type.
 */
export type RequestResponseMessageMap = {
    'loadDEMTile': [WorkerDEMTileParameters, DEMData];
    'getClusterExpansionZoom': [ClusterIDAndSource, number];
    'getClusterChildren': [ClusterIDAndSource, Array<GeoJSON.Feature>];
    'getClusterLeaves': [GetClusterLeavesParams, Array<GeoJSON.Feature>];
    'loadData': [LoadGeoJSONParameters, GeoJSONWorkerSourceLoadDataResult];
    'loadTile': [WorkerTileParameters, WorkerTileResult];
    'reloadTile': [WorkerTileParameters, WorkerTileResult];
    'getGlyphs': [GetGlyphsParamerters, GetGlyphsResponse];
    'getImages': [GetImagesParamerters, GetImagesResponse];
    'setImages': [string[], void];
    'setLayers': [Array<LayerSpecification>, void];
    'updateLayers': [UpdateLayersParamaeters, void];
    'syncRTLPluginState': [PluginState, boolean];
    'setReferrer': [string, void];
    'removeSource': [RemoveSourceParams, void];
    'removeMap': [undefined, void];
    'importScript': [string, void];
    'removeTile': [TileParameters, void];
    'abortTile': [TileParameters, void];
    'removeDEMTile': [TileParameters, void];
    'getResource': [RequestParameters, GetResourceResponse<any>];
}

/**
 * All the possible message types that can be sent to and from the worker
 */
export type MessageType = keyof RequestResponseMessageMap;

/**
 * The message to be sent by the actor
 */
export type ActorMessage<T extends MessageType> = {
    type: T;
    data: RequestResponseMessageMap[T][0];
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    sourceMapId?: string | number | null;
};

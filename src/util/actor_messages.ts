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
    data?: GeoJSON.GeoJSON;
    resourceTiming?: {[_: string]: Array<PerformanceResourceTiming>};
    abandoned?: boolean;
};

/**
 * Parameters needed to remove a source
 */
export type RemoveSourceParams = {
    source: string;
    type: string;
};

/**
 * Parameters needed to update the layers
 */
export type UpdateLayersParameters = {
    layers: Array<LayerSpecification>;
    removedIds: Array<string>;
};

/**
 * Parameters needed to get the images
 */
export type GetImagesParameters = {
    icons: Array<string>;
    source: string;
    tileID: OverscaledTileID;
    type: string;
};

/**
 * Parameters needed to get the glyphs
 */
export type GetGlyphsParameters = {
    type: string;
    stacks: {[_: string]: Array<number>};
    source: string;
    tileID: OverscaledTileID;
};

/**
 * A response object returned when requesting glyphs
 */
export type GetGlyphsResponse = {
    [stack: string]: {
        [id: number]: StyleGlyph;
    };
};

/**
 * A response object returned when requesting images
 */
export type GetImagesResponse = {[_: string]: StyleImage};

/**
 * All the possible message types that can be sent to and from the worker
 */
export const enum MessageType {
    loadDEMTile = 'LDT',
    getClusterExpansionZoom = 'GCEZ',
    getClusterChildren = 'GCC',
    getClusterLeaves = 'GCL',
    loadData = 'LD',
    getData = 'GD',
    loadTile = 'LT',
    reloadTile = 'RT',
    getGlyphs = 'GG',
    getImages = 'GI',
    setImages = 'SI',
    updateGlobalState = 'UGS',
    setLayers = 'SL',
    updateLayers = 'UL',
    syncRTLPluginState = 'SRPS',
    setReferrer = 'SR',
    removeSource = 'RS',
    removeMap = 'RM',
    importScript = 'IS',
    removeTile = 'RMT',
    abortTile = 'AT',
    removeDEMTile = 'RDT',
    getResource = 'GR',
}

/**
 * This is basically a mapping between all the calls that are made to and from the workers.
 * The key is the event name, the first parameter is the event input type, and the last parameter is the output type.
 */
export type RequestResponseMessageMap = {
    [MessageType.loadDEMTile]: [WorkerDEMTileParameters, DEMData];
    [MessageType.getClusterExpansionZoom]: [ClusterIDAndSource, number];
    [MessageType.getClusterChildren]: [ClusterIDAndSource, Array<GeoJSON.Feature>];
    [MessageType.getClusterLeaves]: [GetClusterLeavesParams, Array<GeoJSON.Feature>];
    [MessageType.loadData]: [LoadGeoJSONParameters, GeoJSONWorkerSourceLoadDataResult];
    [MessageType.getData]: [LoadGeoJSONParameters, GeoJSON.GeoJSON];
    [MessageType.loadTile]: [WorkerTileParameters, WorkerTileResult];
    [MessageType.reloadTile]: [WorkerTileParameters, WorkerTileResult];
    [MessageType.getGlyphs]: [GetGlyphsParameters, GetGlyphsResponse];
    [MessageType.getImages]: [GetImagesParameters, GetImagesResponse];
    [MessageType.setImages]: [string[], void];
    [MessageType.updateGlobalState]: [Record<string, any>, void];
    [MessageType.setLayers]: [Array<LayerSpecification>, void];
    [MessageType.updateLayers]: [UpdateLayersParameters, void];
    [MessageType.syncRTLPluginState]: [PluginState, PluginState];
    [MessageType.setReferrer]: [string, void];
    [MessageType.removeSource]: [RemoveSourceParams, void];
    [MessageType.removeMap]: [undefined, void];
    [MessageType.importScript]: [string, void];
    [MessageType.removeTile]: [TileParameters, void];
    [MessageType.abortTile]: [TileParameters, void];
    [MessageType.removeDEMTile]: [TileParameters, void];
    [MessageType.getResource]: [RequestParameters, GetResourceResponse<any>];
};

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

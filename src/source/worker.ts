import {Actor, type ActorTarget, type IActor} from '../util/actor';
import {StyleLayerIndex} from '../style/style_layer_index';
import {VectorTileWorkerSource} from './vector_tile_worker_source';
import {RasterDEMTileWorkerSource} from './raster_dem_tile_worker_source';
import {rtlWorkerPlugin, type RTLTextPlugin} from './rtl_text_plugin_worker';
import {GeoJSONWorkerSource, type LoadGeoJSONParameters} from './geojson_worker_source';
import {isWorker} from '../util/util';
import {addProtocol, removeProtocol} from './protocol_crud';
import {type PluginState} from './rtl_text_plugin_status';
import type {
    WorkerSource,
    WorkerSourceConstructor,
    WorkerTileParameters,
    WorkerDEMTileParameters,
    TileParameters
} from '../source/worker_source';

import type {WorkerGlobalScopeInterface} from '../util/web_worker';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {
    MessageType,
    type ClusterIDAndSource,
    type GetClusterLeavesParams,
    type RemoveSourceParams,
    type UpdateLayersParamaeters
} from '../util/actor_messages';

/**
 * The Worker class responsible for background thread related execution
 */
export default class Worker {
    self: WorkerGlobalScopeInterface & ActorTarget;
    actor: Actor;
    layerIndexes: {[_: string]: StyleLayerIndex};
    availableImages: {[_: string]: Array<string>};
    externalWorkerSourceTypes: { [_: string]: WorkerSourceConstructor };
    /**
     * This holds a cache for the already created worker source instances.
     * The cache is build with the following hierarchy:
     * [mapId][sourceType][sourceName]: worker source instance
     * sourceType can be 'vector' for example
     */
    workerSources: {
        [_: string]: {
            [_: string]: {
                [_: string]: WorkerSource;
            };
        };
    };
    /**
     * This holds a cache for the already created DEM worker source instances.
     * The cache is build with the following hierarchy:
     * [mapId][sourceType]: DEM worker source instance
     * sourceType can be 'raster-dem' for example
     */
    demWorkerSources: {
        [_: string]: {
            [_: string]: RasterDEMTileWorkerSource;
        };
    };
    referrer: string;

    constructor(self: WorkerGlobalScopeInterface & ActorTarget) {
        this.self = self;
        this.actor = new Actor(self);

        this.layerIndexes = {};
        this.availableImages = {};

        this.workerSources = {};
        this.demWorkerSources = {};
        this.externalWorkerSourceTypes = {};

        this.self.registerWorkerSource = (name: string, WorkerSource: WorkerSourceConstructor) => {
            if (this.externalWorkerSourceTypes[name]) {
                throw new Error(`Worker source with name "${name}" already registered.`);
            }
            this.externalWorkerSourceTypes[name] = WorkerSource;
        };

        this.self.addProtocol = addProtocol;
        this.self.removeProtocol = removeProtocol;

        // This is invoked by the RTL text plugin when the download via the `importScripts` call has finished, and the code has been parsed.
        this.self.registerRTLTextPlugin = (rtlTextPlugin: RTLTextPlugin) => {

            rtlWorkerPlugin.setMethods(rtlTextPlugin);
        };

        this.actor.registerMessageHandler(MessageType.loadDEMTile, (mapId: string, params: WorkerDEMTileParameters) => {
            return this._getDEMWorkerSource(mapId, params.source).loadTile(params);
        });

        this.actor.registerMessageHandler(MessageType.removeDEMTile, async (mapId: string, params: TileParameters) => {
            this._getDEMWorkerSource(mapId, params.source).removeTile(params);
        });

        this.actor.registerMessageHandler(MessageType.getClusterExpansionZoom, async (mapId: string, params: ClusterIDAndSource) => {
            return (this._getWorkerSource(mapId, params.type, params.source) as GeoJSONWorkerSource).getClusterExpansionZoom(params);
        });

        this.actor.registerMessageHandler(MessageType.getClusterChildren, async (mapId: string, params: ClusterIDAndSource) => {
            return (this._getWorkerSource(mapId, params.type, params.source) as GeoJSONWorkerSource).getClusterChildren(params);
        });

        this.actor.registerMessageHandler(MessageType.getClusterLeaves, async (mapId: string, params: GetClusterLeavesParams) => {
            return (this._getWorkerSource(mapId, params.type, params.source) as GeoJSONWorkerSource).getClusterLeaves(params);
        });

        this.actor.registerMessageHandler(MessageType.loadData, (mapId: string, params: LoadGeoJSONParameters) => {
            return (this._getWorkerSource(mapId, params.type, params.source) as GeoJSONWorkerSource).loadData(params);
        });

        this.actor.registerMessageHandler(MessageType.getData, (mapId: string, params: LoadGeoJSONParameters) => {
            return (this._getWorkerSource(mapId, params.type, params.source) as GeoJSONWorkerSource).getData();
        });

        this.actor.registerMessageHandler(MessageType.loadTile, (mapId: string, params: WorkerTileParameters) => {
            return this._getWorkerSource(mapId, params.type, params.source).loadTile(params);
        });

        this.actor.registerMessageHandler(MessageType.reloadTile, (mapId: string, params: WorkerTileParameters) => {
            return this._getWorkerSource(mapId, params.type, params.source).reloadTile(params);
        });

        this.actor.registerMessageHandler(MessageType.abortTile, (mapId: string, params: TileParameters) => {
            return this._getWorkerSource(mapId, params.type, params.source).abortTile(params);
        });

        this.actor.registerMessageHandler(MessageType.removeTile, (mapId: string, params: TileParameters) => {
            return this._getWorkerSource(mapId, params.type, params.source).removeTile(params);
        });

        this.actor.registerMessageHandler(MessageType.removeSource, async (mapId: string, params: RemoveSourceParams) => {
            if (!this.workerSources[mapId] ||
                !this.workerSources[mapId][params.type] ||
                !this.workerSources[mapId][params.type][params.source]) {
                return;
            }

            const worker = this.workerSources[mapId][params.type][params.source];
            delete this.workerSources[mapId][params.type][params.source];

            if (worker.removeSource !== undefined) {
                worker.removeSource(params);
            }
        });

        this.actor.registerMessageHandler(MessageType.removeMap, async (mapId: string) => {
            delete this.layerIndexes[mapId];
            delete this.availableImages[mapId];
            delete this.workerSources[mapId];
            delete this.demWorkerSources[mapId];
        });

        this.actor.registerMessageHandler(MessageType.setReferrer, async (_mapId: string, params: string) => {
            this.referrer = params;
        });

        this.actor.registerMessageHandler(MessageType.syncRTLPluginState, (mapId: string, params: PluginState) => {
            return this._syncRTLPluginState(mapId, params);
        });

        this.actor.registerMessageHandler(MessageType.importScript, async (_mapId: string, params: string) => {
            this.self.importScripts(params);
        });

        this.actor.registerMessageHandler(MessageType.setImages, (mapId: string, params: string[]) => {
            return this._setImages(mapId, params);
        });

        this.actor.registerMessageHandler(MessageType.updateLayers, async (mapId: string, params: UpdateLayersParamaeters) => {
            this._getLayerIndex(mapId).update(params.layers, params.removedIds);
        });

        this.actor.registerMessageHandler(MessageType.setLayers, async (mapId: string, params: Array<LayerSpecification>) => {
            this._getLayerIndex(mapId).replace(params);
        });
    }

    private async _setImages(mapId: string, images: Array<string>): Promise<void> {
        this.availableImages[mapId] = images;
        for (const workerSource in this.workerSources[mapId]) {
            const ws = this.workerSources[mapId][workerSource];
            for (const source in ws) {
                ws[source].availableImages = images;
            }
        }
    }

    private async _syncRTLPluginState(mapId: string, incomingState: PluginState): Promise<PluginState> {
        const state = await rtlWorkerPlugin.syncState(incomingState, this.self.importScripts);
        return state;
    }

    private _getAvailableImages(mapId: string) {
        let availableImages = this.availableImages[mapId];

        if (!availableImages) {
            availableImages = [];
        }

        return availableImages;
    }

    private _getLayerIndex(mapId: string) {
        let layerIndexes = this.layerIndexes[mapId];
        if (!layerIndexes) {
            layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
        }
        return layerIndexes;
    }

    /**
     * This is basically a lazy initialization of a worker per mapId and sourceType and sourceName
     * @param mapId - the mapId
     * @param sourceType - the source type - 'vector' for example
     * @param sourceName - the source name - 'osm' for example
     * @returns a new instance or a cached one
     */
    private _getWorkerSource(mapId: string, sourceType: string, sourceName: string): WorkerSource {
        if (!this.workerSources[mapId])
            this.workerSources[mapId] = {};
        if (!this.workerSources[mapId][sourceType])
            this.workerSources[mapId][sourceType] = {};

        if (!this.workerSources[mapId][sourceType][sourceName]) {
            // use a wrapped actor so that we can attach a target mapId param
            // to any messages invoked by the WorkerSource, this is very important when there are multiple maps
            const actor: IActor = {
                sendAsync: (message, abortController) => {
                    message.targetMapId = mapId;
                    return this.actor.sendAsync(message, abortController);
                }
            };
            switch (sourceType) {
                case 'vector':
                    this.workerSources[mapId][sourceType][sourceName] = new VectorTileWorkerSource(actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
                    break;
                case 'geojson':
                    this.workerSources[mapId][sourceType][sourceName] = new GeoJSONWorkerSource(actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
                    break;
                default:
                    this.workerSources[mapId][sourceType][sourceName] = new (this.externalWorkerSourceTypes[sourceType])(actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
                    break;
            }
        }

        return this.workerSources[mapId][sourceType][sourceName];
    }

    /**
     * This is basically a lazy initialization of a worker per mapId and source
     * @param mapId - the mapId
     * @param sourceType - the source type - 'raster-dem' for example
     * @returns a new instance or a cached one
     */
    private _getDEMWorkerSource(mapId: string, sourceType: string) {
        if (!this.demWorkerSources[mapId])
            this.demWorkerSources[mapId] = {};

        if (!this.demWorkerSources[mapId][sourceType]) {
            this.demWorkerSources[mapId][sourceType] = new RasterDEMTileWorkerSource();
        }

        return this.demWorkerSources[mapId][sourceType];
    }
}

if (isWorker(self)) {
    self.worker = new Worker(self);
}

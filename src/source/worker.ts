import {Actor, ActorTarget} from '../util/actor';
import {StyleLayerIndex} from '../style/style_layer_index';
import {VectorTileWorkerSource} from './vector_tile_worker_source';
import {RasterDEMTileWorkerSource} from './raster_dem_tile_worker_source';
import {GeoJSONWorkerSource, LoadGeoJSONParameters} from './geojson_worker_source';
import {plugin as globalRTLTextPlugin} from './rtl_text_plugin';
import {isWorker} from '../util/util';

import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerDEMTileParameters,
    TileParameters
} from '../source/worker_source';

import type {WorkerGlobalScopeInterface} from '../util/web_worker';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {PluginState} from './rtl_text_plugin';
import type {ClusterIDAndSource, GetClusterLeavesParams, RemoveSourceParams, UpdateLayersParamaeters} from '../util/actor_messages';

/**
 * The Worker class responsidble for background thread related execution
 */
export default class Worker {
    self: WorkerGlobalScopeInterface & ActorTarget;
    actor: Actor;
    layerIndexes: {[_: string]: StyleLayerIndex};
    availableImages: {[_: string]: Array<string>};
    externalWorkerSourceTypes: {
        [_: string]: {
            new (...args: any): WorkerSource;
        };
    };
    workerSources: {
        [_: string]: {
            [_: string]: {
                [_: string]: WorkerSource;
            };
        };
    };
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

        // [mapId][sourceType][sourceName] => worker source instance
        this.workerSources = {};
        this.demWorkerSources = {};

        this.self.registerWorkerSource = (name: string, WorkerSource: {
            new (...args: any): WorkerSource;
        }) => {
            if (this.externalWorkerSourceTypes[name]) {
                throw new Error(`Worker source with name "${name}" already registered.`);
            }
            this.externalWorkerSourceTypes[name] = WorkerSource;
        };

        // This is invoked by the RTL text plugin when the download via the `importScripts` call has finished, and the code has been parsed.
        this.self.registerRTLTextPlugin = (rtlTextPlugin: {
            applyArabicShaping: Function;
            processBidirectionalText: ((b: string, a: Array<number>) => Array<string>);
            processStyledBidirectionalText?: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>);
        }) => {
            if (globalRTLTextPlugin.isParsed()) {
                throw new Error('RTL text plugin already registered.');
            }
            globalRTLTextPlugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
            globalRTLTextPlugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
            globalRTLTextPlugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;
        };

        this.actor.registerMessageHandler('loadDEMTile', (mapId: string, params: WorkerDEMTileParameters) => {
            return this._getDEMWorkerSource(mapId, params.source).loadTile(params);
        });

        this.actor.registerMessageHandler('removeDEMTile', async (mapId: string, params: TileParameters) => {
            this._getDEMWorkerSource(mapId, params.source).removeTile(params);
        });

        this.actor.registerMessageHandler('geojson.getClusterExpansionZoom', async (mapId: string, params: ClusterIDAndSource) => {
            return (this._getWorkerSource(mapId, 'geojson', params.source) as GeoJSONWorkerSource).getClusterExpansionZoom(params);
        });

        this.actor.registerMessageHandler('geojson.getClusterChildren', async (mapId: string, params: ClusterIDAndSource) => {
            return (this._getWorkerSource(mapId, 'geojson', params.source) as GeoJSONWorkerSource).getClusterChildren(params);
        });

        this.actor.registerMessageHandler('geojson.getClusterLeaves', async (mapId: string, params: GetClusterLeavesParams) => {
            return (this._getWorkerSource(mapId, 'geojson', params.source) as GeoJSONWorkerSource).getClusterLeaves(params);
        });

        this.actor.registerMessageHandler('geojson.loadData', (mapId: string, params: LoadGeoJSONParameters) => {
            return (this._getWorkerSource(mapId, 'geojson', params.source) as GeoJSONWorkerSource).loadData(params);
        });

        this.actor.registerMessageHandler('loadTile', (mapId: string, params: WorkerTileParameters) => {
            return this._getWorkerSource(mapId, params.type, params.source).loadTile(params);
        });

        this.actor.registerMessageHandler('reloadTile', (mapId: string, params: WorkerTileParameters) => {
            return this._getWorkerSource(mapId, params.type, params.source).reloadTile(params);
        });

        this.actor.registerMessageHandler('abortTile', (mapId: string, params: TileParameters) => {
            return this._getWorkerSource(mapId, params.type, params.source).abortTile(params);
        });

        this.actor.registerMessageHandler('removeTile', (mapId: string, params: TileParameters) => {
            return this._getWorkerSource(mapId, params.type, params.source).removeTile(params);
        });

        this.actor.registerMessageHandler('removeSource', async (mapId: string, params: RemoveSourceParams) => {
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

        this.actor.registerMessageHandler('setReferrer', async (_mapId: string, params: string) => {
            this.referrer = params;
        });

        this.actor.registerMessageHandler('syncRTLPluginState', (mapId: string, params: PluginState) => {
            return this._syncRTLPluginState(mapId, params);
        });

        this.actor.registerMessageHandler('loadWorkerSource', async (_mapId: string, params: string) => {
            this.self.importScripts(params);
        });

        this.actor.registerMessageHandler('setImages', (mapId: string, params: string[]) => {
            return this._setImages(mapId, params);
        });

        this.actor.registerMessageHandler('updateLayers', async (mapId: string, params: UpdateLayersParamaeters) => {
            this._getLayerIndex(mapId).update(params.layers, params.removedIds);
        });

        this.actor.registerMessageHandler('setLayers', async (mapId: string, params: Array<LayerSpecification>) => {
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

    private async _syncRTLPluginState(map: string, state: PluginState): Promise<boolean> {
        globalRTLTextPlugin.setState(state);
        const pluginURL = globalRTLTextPlugin.getPluginURL();
        if (
            globalRTLTextPlugin.isLoaded() &&
            !globalRTLTextPlugin.isParsed() &&
            pluginURL != null // Not possible when `isLoaded` is true, but keeps flow happy
        ) {
            this.self.importScripts(pluginURL);
            const complete = globalRTLTextPlugin.isParsed();
            if (complete) {
                return true;
            }
            throw new Error(`RTL Text Plugin failed to import scripts from ${pluginURL}`);
        }
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
            // to any messages invoked by the WorkerSource
            // HM TODO: is this still needed??
            //const actor = {
            //    send: (type, data, callback) => {
            //        this.actor.send(type, data, callback, mapId);
            //    }
            //};
            switch (sourceType) {
                case 'vector':
                    this.workerSources[mapId][sourceType][sourceName] = new VectorTileWorkerSource(this.actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
                    break;
                case 'geojson':
                    this.workerSources[mapId][sourceType][sourceName] = new GeoJSONWorkerSource(this.actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
                    break;
                default:
                    this.workerSources[mapId][sourceType][sourceName] = new (this.externalWorkerSourceTypes[sourceType])(this.actor, this._getLayerIndex(mapId), this._getAvailableImages(mapId));
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

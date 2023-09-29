import {ExpiryData, getArrayBuffer} from '../util/ajax';

import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import {WorkerTile} from './worker_tile';
import {extend} from '../util/util';
import {RequestPerformance} from '../util/performance';

import type {
    WorkerSource,
    WorkerTileParameters,
    WorkerTileCallback,
    TileParameters
} from '../source/worker_source';

import type {Actor} from '../util/actor';
import type {StyleLayerIndex} from '../style/style_layer_index';
import type {Callback} from '../types/callback';
import type {VectorTile} from '@mapbox/vector-tile';

export type LoadVectorTileResult = {
    vectorTile: VectorTile;
    rawData: ArrayBuffer;
    resourceTiming?: Array<PerformanceResourceTiming>;
} & ExpiryData;

type FetchingState = {
    rawTileData: ArrayBuffer;
    cacheControl: ExpiryData;
    resourceTiming: any;
}

/**
 * The callback when finished loading vector data
 */
export type LoadVectorDataCallback = Callback<LoadVectorTileResult>;

export type AbortVectorData = () => void;
export type LoadVectorData = (params: WorkerTileParameters, callback: LoadVectorDataCallback) => AbortVectorData | void;

/**
 * Loads a vector tile
 */
function loadVectorTile(params: WorkerTileParameters, callback: LoadVectorDataCallback) {
    const request = getArrayBuffer(params.request, (err?: Error | null, data?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {
        if (err) {
            callback(err);
        } else if (data) {
            try {
                const vectorTile = new vt.VectorTile(new Protobuf(data));
                callback(null, {
                    vectorTile,
                    rawData: data,
                    cacheControl,
                    expires
                });
            } catch (ex) {
                const bytes = new Uint8Array(data);
                const isGzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
                let errorMessage = `Unable to parse the tile at ${params.request.url}, `;
                if (isGzipped) {
                    errorMessage += 'please make sure the data is not gzipped and that you have configured the relevant header in the server';
                } else {
                    errorMessage += `got error: ${ex.messge}`;
                }
                callback(new Error(errorMessage));
            }
        }
    });
    return () => {
        request.cancel();
        callback();
    };
}

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(actor, styleLayers, customLoadVectorDataFunction)`.
 */
export class VectorTileWorkerSource implements WorkerSource {
    actor: Actor;
    layerIndex: StyleLayerIndex;
    availableImages: Array<string>;
    loadVectorData: LoadVectorData;
    fetching: {[_: string]: FetchingState };
    loading: {[_: string]: WorkerTile};
    loaded: {[_: string]: WorkerTile};

    /**
     * @param loadVectorData - Optional method for custom loading of a VectorTile
     * object based on parameters passed from the main-thread Source. See
     * {@link VectorTileWorkerSource#loadTile}. The default implementation simply
     * loads the pbf at `params.url`.
     */
    constructor(actor: Actor, layerIndex: StyleLayerIndex, availableImages: Array<string>, loadVectorData?: LoadVectorData | null) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.loadVectorData = loadVectorData || loadVectorTile;
        this.fetching = {};
        this.loading = {};
        this.loaded = {};
    }

    /**
     * Implements {@link WorkerSource#loadTile}. Delegates to
     * {@link VectorTileWorkerSource#loadVectorData} (which by default expects
     * a `params.url` property) for fetching and producing a VectorTile object.
     */
    loadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const uid = params.uid;

        if (!this.loading)
            this.loading = {};

        const perf = (params && params.request && params.request.collectResourceTiming) ?
            new RequestPerformance(params.request) : false;

        const workerTile = this.loading[uid] = new WorkerTile(params);
        workerTile.abort = this.loadVectorData(params, (err, response) => {
            delete this.loading[uid];

            if (err || !response) {
                workerTile.status = 'done';
                this.loaded[uid] = workerTile;
                return callback(err);
            }

            const rawTileData = response.rawData;
            const cacheControl = {} as ExpiryData;
            if (response.expires) cacheControl.expires = response.expires;
            if (response.cacheControl) cacheControl.cacheControl = response.cacheControl;

            const resourceTiming = {} as {resourceTiming: any};
            if (perf) {
                const resourceTimingData = perf.finish();
                // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                // late evaluation in the main thread causes TypeError: illegal invocation
                if (resourceTimingData)
                    resourceTiming.resourceTiming = JSON.parse(JSON.stringify(resourceTimingData));
            }

            workerTile.vectorTile = response.vectorTile;
            workerTile.parse(response.vectorTile, this.layerIndex, this.availableImages, this.actor, (err, result) => {
                delete this.fetching[uid];
                if (err || !result) return callback(err);

                // Transferring a copy of rawTileData because the worker needs to retain its copy.
                callback(null, extend({rawTileData: rawTileData.slice(0)}, result, cacheControl, resourceTiming));
            });

            this.loaded = this.loaded || {};
            this.loaded[uid] = workerTile;
            // keep the original fetching state so that reload tile can pick it up if the original parse is cancelled by reloads' parse
            this.fetching[uid] = {rawTileData, cacheControl, resourceTiming};
        }) as AbortVectorData;
    }

    /**
     * Implements {@link WorkerSource#reloadTile}.
     */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded;
        const uid = params.uid;
        if (loaded && loaded[uid]) {
            const workerTile = loaded[uid];
            workerTile.showCollisionBoxes = params.showCollisionBoxes;
            if (workerTile.status === 'parsing') {
                workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, (err, result) => {
                    if (err || !result) return callback(err, result);

                    // if we have cancelled the original parse, make sure to pass the rawTileData from the original fetch
                    let parseResult;
                    if (this.fetching[uid]) {
                        const {rawTileData, cacheControl, resourceTiming} = this.fetching[uid];
                        delete this.fetching[uid];
                        parseResult = extend({rawTileData: rawTileData.slice(0)}, result, cacheControl, resourceTiming);
                    } else {
                        parseResult = result;
                    }

                    callback(null, parseResult);
                });
            } else if (workerTile.status === 'done') {
                // if there was no vector tile data on the initial load, don't try and re-parse tile
                if (workerTile.vectorTile) {
                    workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, callback);
                } else {
                    callback();
                }
            }
        }
    }

    /**
     * Implements {@link WorkerSource#abortTile}.
     *
     * @param params - The tile parameters
     * @param callback - The callback
     */
    abortTile(params: TileParameters, callback: WorkerTileCallback) {
        const loading = this.loading,
            uid = params.uid;
        if (loading && loading[uid] && loading[uid].abort) {
            loading[uid].abort();
            delete loading[uid];
        }
        callback();
    }

    /**
     * Implements {@link WorkerSource#removeTile}.
     *
     * @param params - The tile parameters
     * @param callback - The callback
     */
    removeTile(params: TileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
        callback();
    }
}

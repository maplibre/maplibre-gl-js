import {ExpiryData, getArrayBuffer} from '../util/ajax';

import vt from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import {WorkerTile} from './worker_tile';
import {extend} from '../util/util';
import {RequestPerformance} from '../util/performance';

import type {
    WorkerSource,
    WorkerTileParameters,
    TileParameters,
    WorkerTileResult
} from '../source/worker_source';

import type {IActor} from '../util/actor';
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
export type LoadVectorData = (params: WorkerTileParameters, abortController: AbortController) => Promise<LoadVectorTileResult | null>;

let me = 0;

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(actor, styleLayers, customLoadVectorDataFunction)`.
 */
export class VectorTileWorkerSource implements WorkerSource {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: Array<string>;
    loadVectorData: LoadVectorData;
    fetching: {[_: string]: FetchingState };
    loading: {[_: string]: WorkerTile};
    loaded: {[_: string]: WorkerTile};
    my: number;

    /**
     * @param loadVectorData - Optional method for custom loading of a VectorTile
     * object based on parameters passed from the main-thread Source. See
     * {@link VectorTileWorkerSource#loadTile}. The default implementation simply
     * loads the pbf at `params.url`.
     */
    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: Array<string>, loadVectorData?: LoadVectorData | null) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.loadVectorData = loadVectorData || this.loadVectorTile;
        this.fetching = {};
        this.loading = {};
        this.loaded = {};
        this.my = me++;
    }

    /**
     * Loads a vector tile
     */
    loadVectorTile(params: WorkerTileParameters, abortController: AbortController): Promise<LoadVectorTileResult> {
        return new Promise((resolve, reject) => {
            const request = getArrayBuffer(params.request, (err?: Error | null, data?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (data) {
                    try {
                        const vectorTile = new vt.VectorTile(new Protobuf(data));
                        resolve({
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
                        reject(new Error(errorMessage));
                    }
                }
            });
            abortController.signal.addEventListener('abort', () => {
                request.cancel();
                reject(new Error('AbortError'));
            });
        });
    }

    /**
     * Implements {@link WorkerSource#loadTile}. Delegates to
     * {@link VectorTileWorkerSource#loadVectorData} (which by default expects
     * a `params.url` property) for fetching and producing a VectorTile object.
     */
    async loadTile(params: WorkerTileParameters): Promise<WorkerTileResult | null> {
        const tileUid = params.uid;

        const perf = (params && params.request && params.request.collectResourceTiming) ?
            new RequestPerformance(params.request) : false;

        const workerTile = new WorkerTile(params);
        this.loading[tileUid] = workerTile;

        const abortController = new AbortController();
        workerTile.abort = abortController;
        try {
            const response = await this.loadVectorData(params, abortController);
            delete this.loading[tileUid];
            if (!response) {
                // HM TODO: add a test that is parsing an empty tile and is getting here
                return null;
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
            const parsePromise = workerTile.parse(response.vectorTile, this.layerIndex, this.availableImages, this.actor);
            this.loaded[tileUid] = workerTile;
            // keep the original fetching state so that reload tile can pick it up if the original parse is cancelled by reloads' parse
            this.fetching[tileUid] = {rawTileData, cacheControl, resourceTiming};

            try {
                const result = await parsePromise;
                // Transferring a copy of rawTileData because the worker needs to retain its copy.
                return extend({rawTileData: rawTileData.slice(0)}, result, cacheControl, resourceTiming);
            } finally {
                delete this.fetching[tileUid];
            }
        } catch (err) {
            delete this.loading[tileUid];
            workerTile.status = 'done';
            this.loaded[tileUid] = workerTile;
            throw err;
        }
    }

    /**
     * Implements {@link WorkerSource#reloadTile}.
     */
    async reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult> {
        const uid = params.uid;
        if (!this.loaded || !this.loaded[uid]) {
            throw new Error('Should not be trying to reload a tile that was never loaded or has been removed');
        }
        const workerTile = this.loaded[uid];
        workerTile.showCollisionBoxes = params.showCollisionBoxes;
        if (workerTile.status === 'parsing') {
            const result = await workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor);
            // if we have cancelled the original parse, make sure to pass the rawTileData from the original fetch
            let parseResult: WorkerTileResult;
            if (this.fetching[uid]) {
                const {rawTileData, cacheControl, resourceTiming} = this.fetching[uid];
                delete this.fetching[uid];
                parseResult = extend({rawTileData: rawTileData.slice(0)}, result, cacheControl, resourceTiming);
            } else {
                parseResult = result;
            }
            return parseResult;

        }
        // if there was no vector tile data on the initial load, don't try and re-parse tile
        if (workerTile.status === 'done' && workerTile.vectorTile) {
            // HM TODO: this seems like a missing case where cache control is lost?
            return workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor);
        }
    }

    /**
     * Implements {@link WorkerSource#abortTile}.
     *
     * @param params - The tile parameters
     * @param callback - The callback
     */
    async abortTile(params: TileParameters): Promise<void> {
        const loading = this.loading;
        const uid = params.uid;
        if (loading && loading[uid] && loading[uid].abort) {
            loading[uid].abort.abort();
            delete loading[uid];
        }
    }

    /**
     * Implements {@link WorkerSource#removeTile}.
     *
     * @param params - The tile parameters
     * @param callback - The callback
     */
    async removeTile(params: TileParameters): Promise<void> {
        if (this.loaded && this.loaded[params.uid]) {
            delete this.loaded[params.uid];
        }
    }
}

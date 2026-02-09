import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {type ExpiryData, getArrayBuffer} from '../util/ajax';
import {WorkerTile} from './worker_tile';
import {WorkerTileState, type ParsingState} from './worker_tile_state';
import {BoundedLRUCache} from '../tile/tile_cache';
import {extend} from '../util/util';
import {RequestPerformance} from '../util/performance';
import {VectorTileOverzoomed, sliceVectorTileLayer, toVirtualVectorTile} from './vector_tile_overzoomed';
import {MLTVectorTile} from './vector_tile_mlt';
import type {
    WorkerSource,
    WorkerTileParameters,
    TileParameters,
    WorkerTileResult
} from '../source/worker_source';
import type {IActor} from '../util/actor';
import type {StyleLayer} from '../style/style_layer';
import type {StyleLayerIndex} from '../style/style_layer_index';
import type {VectorTileLayerLike, VectorTileLike} from '@maplibre/vt-pbf';

export type LoadVectorTileResult = {
    vectorTile: VectorTileLike;
    rawData: ArrayBufferLike;
    resourceTiming?: Array<PerformanceResourceTiming>;
} & ExpiryData;

export type AbortVectorData = () => void;
export type LoadVectorData = (params: WorkerTileParameters, abortController: AbortController) => Promise<LoadVectorTileResult | null>;

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation. To do so, override its `loadVectorTile` method.
 */
export class VectorTileWorkerSource implements WorkerSource {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: Array<string>;
    tileState: WorkerTileState;
    overzoomedTileResultCache: BoundedLRUCache<string, LoadVectorTileResult>;

    /**
     * @param loadVectorData - Optional method for custom loading of a VectorTile
     * object based on parameters passed from the main-thread Source. See
     * {@link VectorTileWorkerSource.loadTile}. The default implementation simply
     * loads the pbf at `params.url`.
     */
    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: Array<string>) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.tileState = new WorkerTileState();
        this.overzoomedTileResultCache = new BoundedLRUCache<string, LoadVectorTileResult>(1000);
    }

    /**
     * Loads a vector tile
     */
    async loadVectorTile(params: WorkerTileParameters, abortController: AbortController): Promise<LoadVectorTileResult> {
        const response = await getArrayBuffer(params.request, abortController);
        try {
            const vectorTile = params.encoding !== 'mlt'
                ? new VectorTile(new Protobuf(response.data))
                : new MLTVectorTile(response.data);
            return {
                vectorTile,
                rawData: response.data,
                cacheControl: response.cacheControl,
                expires: response.expires
            };
        } catch (ex) {
            const bytes = new Uint8Array(response.data);
            const isGzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
            let errorMessage = `Unable to parse the tile at ${params.request.url}, `;
            if (isGzipped) {
                errorMessage += 'please make sure the data is not gzipped and that you have configured the relevant header in the server';
            } else {
                errorMessage += `got error: ${ex.message}`;
            }
            throw new Error(errorMessage);
        }
    }

    /**
     * Implements {@link WorkerSource.loadTile}. Delegates to
     * {@link VectorTileWorkerSource.loadVectorData} (which by default expects
     * a `params.url` property) for fetching and producing a VectorTile object.
     */
    async loadTile(params: WorkerTileParameters): Promise<WorkerTileResult | null> {
        const {uid, overzoomParameters} = params;

        if (overzoomParameters) {
            params.request = overzoomParameters.overzoomRequest;
        }

        const timing = this._startRequestTiming(params);
        const workerTile = new WorkerTile(params);

        this.tileState.startLoading(uid, workerTile);
        const abortController = new AbortController();
        workerTile.abort = abortController;
        try {
            const response = await this.loadVectorTile(params, abortController);
            this.tileState.finishLoading(uid);
            if (!response) return null;

            let {vectorTile, rawData} = response;
            if (overzoomParameters) {
                ({vectorTile, rawData} = this._getOverzoomTile(params, response.vectorTile));
            }

            const cacheControl = this._getExpiryData(response);
            const resourceTiming = this._finishRequestTiming(timing);

            workerTile.vectorTile = vectorTile;
            this.tileState.markLoaded(uid, workerTile);

            const parseState = {rawData, cacheControl, resourceTiming};  // Keep data so reloadTile can access if parse is canceled.
            this.tileState.setParsing(uid, parseState);
            try {
                return await this._parseWorkerTile(workerTile, params, parseState);
            } finally {
                this.tileState.clearParsing(uid);
            }
        } catch (err) {
            this.tileState.finishLoading(uid);
            workerTile.status = 'done';
            this.tileState.markLoaded(uid, workerTile);
            throw err;
        }
    }

    async _parseWorkerTile(workerTile: WorkerTile, params: WorkerTileParameters, parseState?: ParsingState): Promise<WorkerTileResult> {
        let result = await workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, params.subdivisionGranularity);

        if (parseState) {
            const {rawData, cacheControl, resourceTiming} = parseState;
            // Transferring a copy of rawTileData because the worker needs to retain its copy.
            result = extend({rawTileData: rawData.slice(0), encoding: params.encoding}, result, cacheControl, resourceTiming);
        }

        return result;
    }

    _getExpiryData(response: LoadVectorTileResult): ExpiryData {
        const {expires, cacheControl} = response;

        const data: ExpiryData = {};
        if (expires) data.expires = expires;
        if (cacheControl) data.cacheControl = cacheControl;

        return data;
    }

    _startRequestTiming(params: WorkerTileParameters): RequestPerformance | undefined {
        if (!params.request?.collectResourceTiming) return;
        return new RequestPerformance(params.request.url);
    }

    _finishRequestTiming(timing: RequestPerformance): {resourceTiming?: any} {
        const timingData = timing?.finish();
        if (!timingData) return {};

        // it's necessary to eval the result of getEntriesByName() here via parse/stringify
        // late evaluation in the main thread causes TypeError: illegal invocation
        return {resourceTiming: JSON.parse(JSON.stringify(timingData))};
    }

    /**
     * If we are seeking a tile deeper than the source's max available canonical tile, get the overzoomed tile
     * @param params - the worker tile parameters
     * @param maxZoomVectorTile - the original vector tile at the source's max available canonical zoom
     * @returns the overzoomed tile and its raw data
     */
    private _getOverzoomTile(params: WorkerTileParameters, maxZoomVectorTile: VectorTileLike): LoadVectorTileResult {
        const {tileID, source, overzoomParameters} = params;
        const {maxZoomTileID} = overzoomParameters;

        const cacheKey = `${maxZoomTileID.key}_${tileID.key}`;
        const cachedOverzoomTile = this.overzoomedTileResultCache.get(cacheKey);

        if (cachedOverzoomTile) {
            return cachedOverzoomTile;
        }

        const overzoomedVectorTile = new VectorTileOverzoomed();
        const layerFamilies: Record<string, StyleLayer[][]> = this.layerIndex.familiesBySource[source];

        for (const sourceLayerId in layerFamilies) {
            const sourceLayer: VectorTileLayerLike = maxZoomVectorTile.layers[sourceLayerId];
            if (!sourceLayer) {
                continue;
            }

            const slicedTileLayer = sliceVectorTileLayer(sourceLayer, maxZoomTileID, tileID.canonical);
            if (slicedTileLayer.length > 0) {
                overzoomedVectorTile.addLayer(slicedTileLayer);
            }
        }
        const overzoomedVectorTileResult = toVirtualVectorTile(overzoomedVectorTile);
        this.overzoomedTileResultCache.set(cacheKey, overzoomedVectorTileResult);

        return overzoomedVectorTileResult;
    }

    /**
     * Implements {@link WorkerSource.reloadTile}.
     */
    async reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult> {
        const uid = params.uid;

        const workerTile = this.tileState.getLoaded(uid);
        if (!workerTile) throw new Error('Should not be trying to reload a tile that was never loaded or has been removed');

        workerTile.showCollisionBoxes = params.showCollisionBoxes;

        if (workerTile.status === 'parsing') {
            // if we are cancelling the original parse, make sure to pass the rawTileData from the original parse
            const parseState = this.tileState.consumeParsing(uid);
            return await this._parseWorkerTile(workerTile, params, parseState);
        }

        // If there was no vector tile data on the initial load, don't try and reparse the tile.
        // this seems like a missing case where cache control is lost? see #3309
        if (workerTile.status === 'done' && workerTile.vectorTile) {
            return await this._parseWorkerTile(workerTile, params);
        }
    }

    /**
     * Implements {@link WorkerSource.abortTile}.
     */
    async abortTile(params: TileParameters): Promise<void> {
        this.tileState.abort(params.uid);
    }

    /**
     * Implements {@link WorkerSource.removeTile}.
     */
    async removeTile(params: TileParameters): Promise<void> {
        this.tileState.removeLoaded(params.uid);
    }
}

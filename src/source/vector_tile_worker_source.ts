import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {fromVectorTileJs, type VectorTileLayerLike, type VectorTileLike} from '@maplibre/vt-pbf';
import {type ExpiryData, type GetResourceResponse, getArrayBuffer} from '../util/ajax.ts';
import {WorkerTile} from './worker_tile.ts';
import {WorkerTileState} from './worker_tile_state.ts';
import {BoundedLRUCache} from '../tile/tile_cache.ts';
import {ensureError, extend} from '../util/util.ts';
import {RequestPerformance} from '../util/request_performance.ts';
import {VectorTileOverzoomed, sliceVectorTileLayer} from './vector_tile_overzoomed.ts';
import {MLTVectorTile} from './vector_tile_mlt.ts';

import type {
    WorkerSource,
    WorkerTileParameters,
    TileParameters,
    WorkerTileResult,
    SourceTileRequest
} from '../source/worker_source.ts';
import type {IActor} from '../util/actor.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {StyleLayerIndex} from '../style/style_layer_index.ts';

export type LoadVectorTileResult = {
    vectorTile: VectorTileLike;
    rawData: ArrayBufferLike;
};

type SourceTileResponse = {
    response: GetResourceResponse<ArrayBuffer>;
    /** The tile the response holds when it is not the requested tile itself, which is then sliced from it. */
    sourceTile?: SourceTileRequest;
};

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}. This class is
 * used by vector tile sources to perform tile processing operations in a separate worker thread.
 */
export class VectorTileWorkerSource implements WorkerSource {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: string[];
    tileState: WorkerTileState;
    overzoomedTileResultCache: BoundedLRUCache<string, LoadVectorTileResult>;

    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: string[]) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.tileState = new WorkerTileState();
        this.overzoomedTileResultCache = new BoundedLRUCache<string, LoadVectorTileResult>(1000);
    }

    /**
     * Loads a vector tile
     */
    loadVectorTile(params: WorkerTileParameters, rawData: ArrayBuffer): LoadVectorTileResult {
        try {
            const vectorTile = params.encoding !== 'mlt'
                ? new VectorTile(new PbfReader(rawData))
                : new MLTVectorTile(rawData);

            return {vectorTile, rawData};
        } catch (ex) {
            const bytes = new Uint8Array(rawData);
            const isGzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
            let errorMessage = `Unable to parse the tile at ${params.request.url}, `;
            if (isGzipped) {
                errorMessage += 'please make sure the data is not gzipped and that you have configured the relevant header in the server';
            } else {
                errorMessage += `got error: ${ensureError(ex).message}`;
            }
            throw new Error(errorMessage);
        }
    }

    /**
     * Implements {@link WorkerSource.loadTile}.
     * An unchanged ETag skips parsing only when this worker holds a decoded copy of that version,
     * which is what a later `reloadTile` reparses; otherwise the response is parsed and stored like a new tile.
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
            const {response: tileResponse, sourceTile} = await this._fetchSourceTile(params, abortController);

            const loadedTile = this.tileState.getLoaded(uid);
            // Tile data hasn't changed (etag support) - return an unmodified result
            if (params.etag && params.etag === tileResponse.etag && loadedTile?.etag === tileResponse.etag) {
                this.tileState.finishLoading(uid);
                return this._getEtagUnmodifiedResult(tileResponse, timing);
            }

            const tileResult = this.loadVectorTile(params, tileResponse.data);
            this.tileState.finishLoading(uid);
            if (!tileResult) return null;

            let {vectorTile, rawData} = tileResult;
            if (sourceTile) {
                ({vectorTile, rawData} = this._getSlicedTile(params, sourceTile, vectorTile));
            }
            const encoding = sourceTile ? 'mvt' : params.encoding;

            const cacheControl = this._getExpiryData(tileResponse);
            const resourceTiming = this._finishRequestTiming(timing);

            workerTile.vectorTile = vectorTile;
            workerTile.etag = tileResponse.etag;
            this.tileState.markLoaded(uid, workerTile);
            const parsingState = {rawData, encoding, cacheControl, resourceTiming};
            this.tileState.setParsing(uid, parsingState);

            return await this._parseWorkerTile(workerTile, params);
        } catch (err) {
            this.tileState.finishLoading(uid);
            this.tileState.markLoaded(uid, workerTile);
            throw err;
        }
    }

    _getEtagUnmodifiedResult(response: ExpiryData, timing: RequestPerformance): WorkerTileResult {
        const cacheControl = this._getExpiryData(response);
        const resourceTiming = this._finishRequestTiming(timing);
        return extend({etagUnmodified: true as const}, cacheControl, resourceTiming);
    }

    async _parseWorkerTile(workerTile: WorkerTile, params: WorkerTileParameters): Promise<WorkerTileResult> {
        const parseState = this.tileState.getParsing(workerTile.uid);

        let result = await workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, params.subdivisionGranularity);

        // We need to pass rawTileData back to the main thread so that it can be stored in the Tile and FeatureIndex.
        // After the main thread has successfully received and stored rawTileData,
        // we no longer need to store it in the worker or transfer additional copies of it.
        if (parseState) {
            const {rawData, encoding, cacheControl, resourceTiming} = parseState;
            // Return a copy of rawData to the main thread to avoid clearing the worker's buffer
            result = extend({rawTileData: rawData.slice(0), encoding}, result, cacheControl, resourceTiming);
            this.tileState.removeParsing(workerTile.uid);
        } else if (workerTile.etag) {
            // Reload: return the stored etag since the main thread overwrites the tile's etag with every
            // result (#3309). cacheControl/expires are deliberately not re-sent: the main thread anchors
            // max-age to the time it receives them, and the tile's expiration already survives a reload.
            result = extend(result, {etag: workerTile.etag});
        }

        return result;
    }

    _getExpiryData({expires, cacheControl, etag}: ExpiryData): ExpiryData {
        const data: ExpiryData = {};
        if (expires) data.expires = expires;
        if (cacheControl) data.cacheControl = cacheControl;
        if (etag) data.etag = etag;
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
     * Downloads the data that the tile in `params` is made from.
     *
     * That is the tile itself, or the source's maxzoom tile when it is overzoomed. When that responds with a 404, it is the nearest of
     * `params.parentTileRequests` that exists, and the 404 is rethrown when none of them does.
     */
    private async _fetchSourceTile(params: WorkerTileParameters, abortController: AbortController): Promise<SourceTileResponse> {
        const {overzoomParameters, parentTileRequests} = params;
        const sourceTile = overzoomParameters && {tileID: overzoomParameters.maxZoomTileID, request: overzoomParameters.overzoomRequest};
        try {
            return {response: await getArrayBuffer(params.request, abortController), sourceTile};
        } catch (err) {
            if (err?.status !== 404 || !parentTileRequests?.length) {
                throw err;
            }
            return await this._fetchParentTile(parentTileRequests, abortController, err);
        }
    }

    /**
     * Downloads the first of `parentTileRequests` that does not respond with a 404, and throws `notFound` when they all do.
     */
    private async _fetchParentTile(parentTileRequests: SourceTileRequest[], abortController: AbortController, notFound: Error): Promise<SourceTileResponse> {
        for (const sourceTile of parentTileRequests) {
            try {
                return {response: await getArrayBuffer(sourceTile.request, abortController), sourceTile};
            } catch (err) {
                if (err?.status !== 404) {
                    throw err;
                }
            }
        }
        throw notFound;
    }

    /**
     * Slices the tile in `params` out of a tile at a lower zoom that covers it: the source's maxzoom tile when it is overzoomed,
     * or a parent of a tile that responded with a 404.
     * @param params - the worker tile parameters
     * @param sourceTile - the tile that covers the one in `params`, and the request it was fetched with
     * @param sourceVectorTile - the vector tile of `sourceTile`
     * @returns the sliced tile and its raw data, encoded as MVT
     */
    private _getSlicedTile(params: WorkerTileParameters, sourceTile: SourceTileRequest, sourceVectorTile: VectorTileLike): LoadVectorTileResult {
        const {tileID, source} = params;

        const cacheKey = `${sourceTile.tileID.key}_${tileID.key}_${sourceTile.request.url}`;
        const cachedSlicedTile = this.overzoomedTileResultCache.get(cacheKey);

        if (cachedSlicedTile) {
            return cachedSlicedTile;
        }

        const slicedVectorTile = new VectorTileOverzoomed();
        const layerFamilies: Record<string, StyleLayer[][]> = this.layerIndex.familiesBySource[source];

        for (const sourceLayerId in layerFamilies) {
            const sourceLayer: VectorTileLayerLike = sourceVectorTile.layers[sourceLayerId];
            if (!sourceLayer) {
                continue;
            }

            const slicedTileLayer = sliceVectorTileLayer(sourceLayer, sourceTile.tileID, tileID.canonical);
            if (slicedTileLayer.length > 0) {
                slicedVectorTile.addLayer(slicedTileLayer);
            }
        }
        const slicedTileResult = {
            vectorTile: slicedVectorTile,
            rawData: fromVectorTileJs(slicedVectorTile).buffer
        };
        this.overzoomedTileResultCache.set(cacheKey, slicedTileResult);

        return slicedTileResult;
    }

    /**
     * Implements {@link WorkerSource.reloadTile}.
     */
    async reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult> {
        const uid = params.uid;
        const workerTile = this.tileState.getLoaded(uid);
        if (!workerTile) throw new Error('Should not be trying to reload a tile that was never loaded or has been removed');

        // If there was no vector tile data on the initial load, don't try to reparse the tile.
        if (!workerTile.vectorTile) {
            return;
        }

        workerTile.showCollisionBoxes = params.showCollisionBoxes;
        workerTile.tileID = workerTile.tileID.unwrapTo(params.tileID.wrap);
        return await this._parseWorkerTile(workerTile, params);
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

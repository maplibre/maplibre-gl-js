import {fromVectorTileJs, type VectorTileLayerLike, type VectorTileLike} from '@maplibre/vt-pbf';
import {getArrayBuffer} from '../util/ajax.ts';
import {BoundedLRUCache} from '../tile/tile_cache.ts';
import {RequestPerformance} from '../util/request_performance.ts';
import {VectorTileOverzoomed, sliceVectorTileLayer} from './vector_tile_overzoomed.ts';
import {expiryData, VectorWorkerSource} from './vector_worker_source.ts';

import type {LoadVectorTileResult} from './vector_worker_source.ts';
import type {
    WorkerTileParameters,
    WorkerTileResult
} from '../source/worker_source.ts';
import type {IActor} from '../util/actor.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {StyleLayerIndex} from '../style/style_layer_index.ts';

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}. This class is
 * used by vector tile sources to perform tile processing operations in a separate worker thread.
 */
export class VectorTileWorkerSource extends VectorWorkerSource {
    overzoomedTileResultCache: BoundedLRUCache<string, LoadVectorTileResult>;

    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: string[]) {
        super(actor, layerIndex, availableImages);
        this.overzoomedTileResultCache = new BoundedLRUCache<string, LoadVectorTileResult>(1000);
    }

    /**
     * Implements {@link VectorWorkerSource.loadVectorTile}: the tile as fetched, or, for a tile
     * beyond the source's maxzoom, the part of the tile at the maxzoom that it covers. Data whose
     * `etag` is the one the tile was requested with is not read, and is left as fetched.
     */
    async loadVectorTile(params: WorkerTileParameters, abortController: AbortController): Promise<LoadVectorTileResult | null> {
        const request = params.overzoomParameters?.overzoomRequest ?? params.request;
        const timing = request?.collectResourceTiming ? new RequestPerformance(request.url) : undefined;
        const response = await getArrayBuffer(request, abortController);
        const freshness = {...expiryData(response), ...this._finishRequestTiming(timing)};

        if (!params.overzoomParameters || (params.etag && params.etag === response.etag)) {
            return {rawData: response.data, encoding: params.encoding, ...freshness};
        }

        const maxZoomTile = this.decodeTileData({...params, request}, {rawData: response.data, encoding: params.encoding});
        if (!maxZoomTile) return null;
        return {...this._getOverzoomTile(params, maxZoomTile), encoding: 'mvt', ...freshness};
    }

    _finishRequestTiming(timing: RequestPerformance | undefined): {resourceTiming?: any} {
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

        const cacheKey = `${maxZoomTileID.key}_${tileID.key}_${params.request?.url}`;
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
        const overzoomedVectorTileResult = {
            vectorTile: overzoomedVectorTile,
            rawData: fromVectorTileJs(overzoomedVectorTile).buffer
        };
        this.overzoomedTileResultCache.set(cacheKey, overzoomedVectorTileResult);

        return overzoomedVectorTileResult;
    }

    /**
     * Implements {@link WorkerSource.reloadTile}.
     */
    async reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult> {
        if (!this.tileState.getLoaded(params.uid)) throw new Error('Should not be trying to reload a tile that was never loaded or has been removed');
        return super.reloadTile(params);
    }
}

import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {fromVectorTileJs, type VectorTileLike} from '@maplibre/vt-pbf';
import {WorkerTile} from './worker_tile.ts';
import {WorkerTileState, type ParsingState} from './worker_tile_state.ts';
import {MLTVectorTile} from './vector_tile_mlt.ts';
import {ensureError, extend, JSON_PREFIX} from '../util/util.ts';

import type {ExpiryData} from '../util/ajax.ts';
import type {IActor} from '../util/actor.ts';
import type {StyleLayerIndex} from '../style/style_layer_index.ts';
import type {TileEncoding, TileParameters, WorkerSource, WorkerTileParameters, WorkerTileResult} from './worker_source.ts';

/**
 * A tile's data, as returned by {@link VectorWorkerSource.loadVectorTile}.
 *
 * The data may be decoded (`vectorTile`), encoded (`rawData`, in `encoding`),
 * or both, but at least one of them.
 *
 * The choice is the source's to make freely; different choices will be
 * more efficient for different sources. Consumers that need a missing form are
 * obligated to convert it themselves.
 *
 * Whichever form it is in, the result comes with how fresh the data is: what
 * the response it was fetched with said, if any.
 */
export type LoadVectorTileResult = ExpiryData & {resourceTiming?: PerformanceResourceTiming[]; encoding?: TileEncoding} & (
    | {vectorTile: VectorTileLike; rawData?: ArrayBufferLike}
    | {vectorTile?: VectorTileLike; rawData: ArrayBufferLike}
);

/**
 * Decodes a tile's data as fetched.
 *
 * If the data cannot be decoded, throws an error saying why, naming the tile's
 * `url`.
 */
export function decodeTile(data: ArrayBuffer, encoding: TileEncoding | undefined, url: string | undefined): VectorTileLike {
    try {
        return encoding !== 'mlt' ? new VectorTile(new PbfReader(data)) : new MLTVectorTile(data);
    } catch (ex) {
        const bytes = new Uint8Array(data);
        const isGzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
        let errorMessage = `Unable to parse the tile at ${url}, `;
        if (isGzipped) {
            errorMessage += 'please make sure the data is not gzipped and that you have configured the relevant header in the server';
        } else {
            errorMessage += `got error: ${ensureError(ex).message}`;
        }
        throw new Error(errorMessage);
    }
}

/**
 * A copy of the `ExpiryData` with only the fields that are set.
 */
export function expiryData({expires, cacheControl, etag}: ExpiryData): ExpiryData {
    const data: ExpiryData = {};
    if (expires) data.expires = expires;
    if (cacheControl) data.cacheControl = cacheControl;
    if (etag) data.etag = etag;
    return data;
}

/**
 * A tile's data encoded, encoding it only if it is not already.
 *
 * The main thread keeps it for querying the tile's features: either as
 * fetched, or encoded as MVT.
 */
function encodedTileData(tileData: LoadVectorTileResult): Pick<ParsingState, 'rawData' | 'encoding'> {
    return tileData.rawData
        ? {rawData: tileData.rawData, encoding: tileData.encoding}
        : {rawData: fromVectorTileJs(tileData.vectorTile, JSON_PREFIX).buffer, encoding: 'mvt'};
}

/**
 * A {@link WorkerSource} whose tiles are vector data: it loads a tile by loading its data with
 * {@link VectorWorkerSource.loadVectorTile}, which is all a subclass implements, decoding it if
 * it is encoded, and parsing it into buckets for the style's layers.
 *
 * The result of a load carries the tile's data encoded, which the main thread keeps for querying the
 * tile's features, and the expiry data it was fetched with. A tile requested with an `etag` that
 * its data still has is not parsed again: the result says it is unmodified.
 */
export abstract class VectorWorkerSource implements WorkerSource {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: string[];
    tileState: WorkerTileState;

    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: string[]) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.tileState = new WorkerTileState();
    }

    /**
     * Loads a tile's data, not yet parsed into buckets: what {@link VectorWorkerSource.loadTile}
     * parses, fetched or computed as it would be, for code in the worker that reads a source's tiles
     * rather than drawing them. Resolves to null for a tile without data.
     */
    abstract loadVectorTile(params: WorkerTileParameters, abortController: AbortController): Promise<LoadVectorTileResult | null>;

    /**
     * A tile's data decoded, or null for an empty tile.
     */
    decodeTileData(params: WorkerTileParameters, tileData: LoadVectorTileResult): VectorTileLike | null {
        return tileData.vectorTile ?? decodeTile(tileData.rawData as ArrayBuffer, tileData.encoding, params.request?.url);
    }

    /**
     * Implements {@link WorkerSource.loadTile}.
     */
    async loadTile(params: WorkerTileParameters): Promise<WorkerTileResult | null> {
        const {uid} = params;
        const workerTile = new WorkerTile(params);
        this.tileState.startLoading(uid, workerTile);
        const abortController = new AbortController();
        workerTile.abort = abortController;
        try {
            const tileData = await this.loadVectorTile(params, abortController);
            if (tileData && params.etag && params.etag === tileData.etag) {
                this.tileState.finishLoading(uid);
                return extend({etagUnmodified: true as const}, expiryData(tileData), tileData.resourceTiming ? {resourceTiming: tileData.resourceTiming} : {});
            }

            const vectorTile = tileData && this.decodeTileData(params, tileData);
            this.tileState.finishLoading(uid);
            if (!vectorTile) return null;

            workerTile.vectorTile = vectorTile;
            workerTile.etag = tileData.etag;
            this.tileState.markLoaded(uid, workerTile);
            this.tileState.setParsing(uid, {...encodedTileData(tileData), cacheControl: expiryData(tileData), resourceTiming: tileData.resourceTiming});

            return await this._parseWorkerTile(workerTile, params);
        } catch (err) {
            this.tileState.finishLoading(uid);
            this.tileState.markLoaded(uid, workerTile);
            throw err;
        }
    }

    /**
     * Parses a loaded tile. The first parse after a load returns the tile's encoded data and expiry
     * data, which the main thread then keeps, so the worker gives them up; later ones return only
     * the tile's `etag`, which the main thread replaces with each result. The expiry data is not
     * sent again, as the main thread counts its `max-age` from when it receives it.
     */
    async _parseWorkerTile(workerTile: WorkerTile, params: WorkerTileParameters): Promise<WorkerTileResult> {
        const parseState = this.tileState.getParsing(workerTile.uid);

        let result = await workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, params.subdivisionGranularity);

        if (parseState) {
            const {rawData, encoding, cacheControl, resourceTiming} = parseState;
            result = extend({rawTileData: rawData.slice(0), encoding}, result, cacheControl, resourceTiming ? {resourceTiming} : {});
            this.tileState.removeParsing(workerTile.uid);
        } else if (workerTile.etag) {
            result = extend(result, {etag: workerTile.etag});
        }

        return result;
    }

    /**
     * Implements {@link WorkerSource.reloadTile}: parses a loaded tile again, and loads one that is
     * not loaded, such as after the source's data has changed. A tile loaded without data stays
     * without.
     */
    async reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult> {
        const workerTile = this.tileState.getLoaded(params.uid);
        if (!workerTile) {
            return await this.loadTile(params);
        }

        if (!workerTile.vectorTile) {
            return;
        }

        workerTile.showCollisionBoxes = params.showCollisionBoxes;
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

import type {VectorTileLike} from '@maplibre/vt-pbf';
import type {WorkerSource, WorkerTileParameters} from './worker_source.ts';
import type {GeoJSONFeatureId} from './geojson_source_diff.ts';

/**
 * A tile's data before it is parsed: decoded, and also encoded, as fetched or computed, when the
 * source has it so.
 */
export type VectorTileData = {
    vectorTile: VectorTileLike;
    rawData?: ArrayBufferLike;
};

/**
 * A {@link WorkerSource} whose tiles are vector data, which it can give before parsing them,
 * synchronously, from data at hand: a source that fetches its tiles is handed the fetched data.
 * This is what the source combinators read their operands with.
 */
export interface CombinableWorkerSource extends WorkerSource {
    /**
     * A tile's data before it is parsed, or null for a tile without data.
     */
    loadVectorTile(params: WorkerTileParameters, rawData?: ArrayBuffer): VectorTileData | null;
}

/**
 * A {@link CombinableWorkerSource} that a `difference` can subtract: one with the ids of all its
 * features at hand, whichever tiles they are in, and those without a geometry too.
 */
export interface SubtractableWorkerSource extends CombinableWorkerSource {
    /**
     * The ids of all the source's features, by layer.
     */
    featureIds(): Map<string, Set<GeoJSONFeatureId>>;
}

export function isSubtractable(workerSource: CombinableWorkerSource): workerSource is SubtractableWorkerSource {
    return typeof (workerSource as Partial<SubtractableWorkerSource>).featureIds === 'function';
}

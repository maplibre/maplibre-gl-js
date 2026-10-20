import {combined, createOperand, featuresOf, operandTile, loadCombinedWorkerTile, reloadCombinedWorkerTile} from './combinator_worker.ts';
import {isSubtractable} from './combinable_worker_source.ts';
import {WorkerTileState} from './worker_tile_state.ts';

import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';
import type {IActor} from '../util/actor.ts';
import type {StyleLayerIndex} from '../style/style_layer_index.ts';
import type {TileParameters, WorkerTileResult} from './worker_source.ts';
import type {CombinableWorkerSource, SubtractableWorkerSource, VectorTileData} from './combinable_worker_source.ts';
import type {GeoJSONFeatureId} from './geojson_source_diff.ts';
import type {CombinatorOperand, CombinatorTileParameters, SetCombinatorDefinitionParameters} from './combinator_worker.ts';

function unionFeatureIds(workerSources: SubtractableWorkerSource[]): Map<string, Set<GeoJSONFeatureId>> {
    const result = new Map<string, Set<GeoJSONFeatureId>>();
    for (const workerSource of workerSources) {
        for (const [name, ids] of workerSource.featureIds()) {
            result.set(name, new Set([...(result.get(name) ?? []), ...ids]));
        }
    }
    return result;
}

/**
 * The {@link WorkerSource} implementation that supports the `union` source type: each layer of a
 * tile holds the features of that layer of all of its operands' tiles. A tile that only one operand
 * has data for is that operand's, as it is.
 */
export class UnionWorkerSource implements CombinableWorkerSource {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: string[];
    tileState: WorkerTileState;
    operands: CombinatorOperand[];
    /**
     * The ids of all the features, by layer, for a union of {@link SubtractableWorkerSource}s,
     * which is subtractable too; undefined otherwise.
     */
    featureIds?: () => Map<string, Set<GeoJSONFeatureId>>;

    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: string[]) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.tileState = new WorkerTileState();
        this.operands = [];
    }

    /**
     * Builds the operands.
     */
    async setDefinition({source, definition}: SetCombinatorDefinitionParameters): Promise<void> {
        if (definition.type !== 'union') throw new Error(`sources.${source}: not a \`union\` definition`);
        const context = {actor: this.actor, layerIndex: this.layerIndex, availableImages: this.availableImages, source};
        this.operands = await Promise.all(definition.sources.map(operand => createOperand(operand, context)));
        const workerSources = this.operands.map(operand => operand.workerSource);
        this.featureIds = workerSources.every(isSubtractable) ? () => unionFeatureIds(workerSources) : undefined;
        this.tileState.clearLoaded();
    }

    /**
     * Implements {@link CombinableWorkerSource.loadVectorTile}.
     */
    loadVectorTile(params: CombinatorTileParameters): VectorTileData | null {
        const tiles = this.operands.map(operand => operandTile(operand, params, this.layerIndex)).filter(tile => tile);
        if (tiles.length === 0) return null;
        if (tiles.length === 1) return tiles[0];

        const layers = new Map<string, VectorTileFeatureLike[]>();
        for (const tile of tiles) {
            for (const [name, layer] of Object.entries(tile.vectorTile.layers)) {
                layers.set(name, [...(layers.get(name) ?? []), ...featuresOf(layer)]);
            }
        }
        return combined(layers);
    }

    loadTile(params: CombinatorTileParameters): Promise<WorkerTileResult | null> {
        return loadCombinedWorkerTile(this, params);
    }

    reloadTile(params: CombinatorTileParameters): Promise<WorkerTileResult> {
        return reloadCombinedWorkerTile(this, params);
    }

    async abortTile(params: TileParameters): Promise<void> {
        this.tileState.abort(params.uid);
    }

    async removeTile(params: TileParameters): Promise<void> {
        this.tileState.removeLoaded(params.uid);
    }
}

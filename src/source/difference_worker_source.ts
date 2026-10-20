import {createExpression, type ExpressionSpecification, type StyleExpression} from '@maplibre/maplibre-gl-style-spec';
import {combined, createOperand, featuresOf, operandTile, loadCombinedWorkerTile, reloadCombinedWorkerTile} from './combinator_worker.ts';
import {isSubtractable} from './combinable_worker_source.ts';
import {WorkerTileState} from './worker_tile_state.ts';

import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';
import type {IActor} from '../util/actor.ts';
import type {StyleLayerIndex} from '../style/style_layer_index.ts';
import type {TileParameters, WorkerTileResult} from './worker_source.ts';
import type {CombinableWorkerSource, VectorTileData} from './combinable_worker_source.ts';
import type {GeoJSONFeatureId} from './geojson_source_diff.ts';
import type {CombinatorOperand, CombinatorTileParameters, DifferenceKey, SetCombinatorDefinitionParameters} from './combinator_worker.ts';

/**
 * A `difference`'s key expression, compiled; throws an error saying what is wrong with it otherwise.
 */
function compileKey(expression: ExpressionSpecification, rootKey: string): StyleExpression {
    const compiled = createExpression(expression, rootKey);
    if (compiled.result === 'error') throw new Error(`${rootKey}: ${compiled.value.map(error => error.message).join(', ')}`);
    return compiled.value;
}

/**
 * The key of each layer's features, from a `difference`'s `key`: undefined for a layer whose
 * features are matched by their feature id.
 */
function compileKeys(key: DifferenceKey | undefined, rootKey: string): (layer: string) => StyleExpression | undefined {
    if (key === undefined) return () => undefined;
    if (Array.isArray(key)) {
        const compiled = compileKey(key, rootKey);
        return () => compiled;
    }
    const byLayer = new Map(Object.entries(key).map(([name, expression]) => [name, compileKey(expression, `${rootKey}.${name}`)]));
    return layer => byLayer.get(layer);
}

/**
 * The {@link WorkerSource} implementation that supports the `difference` source type: the features
 * of its `source` operand whose key is not the id of a feature of its `subtract` operand in the
 * same layer. The ids are those of all of `subtract`'s features, not just the tile's, so that a
 * feature is subtracted whether or not the feature that subtracts it reaches the tile, or has a
 * geometry at all. Only the features of the layers with ids to subtract are read, and a tile that
 * none are subtracted from is `source`'s, as it is.
 */
export class DifferenceWorkerSource implements CombinableWorkerSource {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: string[];
    tileState: WorkerTileState;
    minuend: CombinatorOperand;
    subtracted: Map<string, Set<GeoJSONFeatureId>>;
    keyOf: (layer: string) => StyleExpression | undefined;

    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: string[]) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.tileState = new WorkerTileState();
        this.subtracted = new Map();
        this.keyOf = () => undefined;
    }

    /**
     * Builds the operands, and compiles the keys.
     */
    async setDefinition({source, definition}: SetCombinatorDefinitionParameters): Promise<void> {
        if (definition.type !== 'difference') throw new Error(`sources.${source}: not a \`difference\` definition`);
        const key = `sources.${source}`;
        const context = {actor: this.actor, layerIndex: this.layerIndex, availableImages: this.availableImages, source};
        const [minuend, subtrahend] = await Promise.all([createOperand(definition.source, context), createOperand(definition.subtract, context)]);
        if (!isSubtractable(subtrahend.workerSource)) {
            throw new Error(`${key}.subtract: a difference subtracts the features of GeoJSON, which has the ids of all its features at hand`);
        }
        this.minuend = minuend;
        this.subtracted = subtrahend.workerSource.featureIds();
        this.keyOf = compileKeys(definition.key, `${key}.key`);
        this.tileState.clearLoaded();
    }

    /**
     * Implements {@link CombinableWorkerSource.loadVectorTile}.
     */
    loadVectorTile(params: CombinatorTileParameters): VectorTileData | null {
        const tileData = operandTile(this.minuend, params, this.layerIndex);
        if (!tileData) return null;

        const tile = tileData.vectorTile;
        const remaining = new Map<string, VectorTileFeatureLike[]>();
        for (const [name, layer] of Object.entries(tile.layers)) {
            const ids = this.subtracted.get(name);
            if (!ids?.size) continue;
            const features = featuresOf(layer);
            const kept = this._kept(name, ids, features, params.zoom);
            if (kept.length < features.length) remaining.set(name, kept);
        }
        if (remaining.size === 0) return tileData;

        const layers = new Map<string, VectorTileFeatureLike[]>();
        for (const [name, layer] of Object.entries(tile.layers)) {
            layers.set(name, remaining.get(name) ?? featuresOf(layer));
        }
        return combined(layers);
    }

    _kept(layer: string, ids: Set<GeoJSONFeatureId>, features: VectorTileFeatureLike[], zoom: number): VectorTileFeatureLike[] {
        const key = this.keyOf(layer);
        return features.filter(feature => !ids.has(key ? key.evaluate({zoom}, feature) : feature.id));
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

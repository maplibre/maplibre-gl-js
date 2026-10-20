import Point from '@mapbox/point-geometry';
import {fromVectorTileJs} from '@maplibre/vt-pbf';
import {EXTENT} from '../data/extent.ts';
import {getArrayBuffer} from '../util/ajax.ts';
import {extend, JSON_PREFIX} from '../util/util.ts';
import {sliceVectorTileLayer, VectorTileOverzoomed} from './vector_tile_overzoomed.ts';
import {VectorTileWorkerSource} from './vector_tile_worker_source.ts';
import {WorkerTile} from './worker_tile.ts';
import {DifferenceWorkerSource} from './difference_worker_source.ts';
import {GeoJSONLayersWorkerSource} from './geojson_layers_worker_source.ts';
import {UnionWorkerSource} from './union_worker_source.ts';

import type {WorkerTileState} from './worker_tile_state.ts';
import type {VectorTileFeatureLike, VectorTileLayerLike, VectorTileLike} from '@maplibre/vt-pbf';
import type {ExpressionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {GeoJSONVTOptions} from '@maplibre/geojson-vt';
import type {RequestParameters} from '../util/ajax.ts';
import type {IActor} from '../util/actor.ts';
import type {StyleLayerIndex} from '../style/style_layer_index.ts';
import type {CanonicalTileID} from '../tile/tile_id.ts';
import type {OverzoomParameters, TileEncoding, WorkerTileParameters, WorkerTileResult} from './worker_source.ts';
import type {CombinableWorkerSource, VectorTileData} from './combinable_worker_source.ts';

/**
 * What a `difference` matches a feature of its `source` by against the ids of the features of its
 * `subtract`: an expression evaluated on the feature, the same for every layer or by layer. A layer
 * without one uses `['id']`, the feature id.
 */
export type DifferenceKey = ExpressionSpecification | Record<string, ExpressionSpecification>;

/**
 * A combinator source's definition as its worker source builds its operands from: the source's
 * definition, with each `vector` operand numbered, so that the main thread can send each tile's
 * requests for them.
 */
export type CombinatorDefinition =
    | {type: 'vector'; leaf: number; encoding?: TileEncoding}
    | {type: 'geojson-layers'; data: Record<string, GeoJSON.GeoJSON>; geojsonVtOptions: GeoJSONVTOptions}
    | {type: 'union'; sources: CombinatorDefinition[]}
    | {type: 'difference'; source: CombinatorDefinition; subtract: CombinatorDefinition; key?: DifferenceKey};

/**
 * Parameters to give a combinator source's worker source its definition.
 */
export type SetCombinatorDefinitionParameters = {
    type: string;
    source: string;
    definition: CombinatorDefinition;
};

/**
 * What a tile's `vector` operand is to load: its request, and the parameters to overzoom it from
 * the tile at that operand's maxzoom, numbered as {@link CombinatorDefinition} numbers the
 * operands; null for an operand without data at the tile's zoom.
 */
export type CombinatorLeafParameters = {
    request: RequestParameters;
    overzoomParameters?: OverzoomParameters;
} | null;

/**
 * Parameters to load a combinator source's tile. `leafData` is each `vector` operand's tile as
 * fetched, once it is.
 */
export type CombinatorTileParameters = WorkerTileParameters & {
    leaves: CombinatorLeafParameters[];
    leafData?: Array<ArrayBuffer | null>;
};

/**
 * An operand of a combinator: the worker source that gives its tiles, and, for a `vector` operand,
 * which of the tile's fetched data is its own.
 */
export type CombinatorOperand = {
    workerSource: CombinableWorkerSource;
    leaf?: number;
    encoding?: TileEncoding;
};

/**
 * A layer of a combined tile: features from any number of tiles, all at {@link EXTENT}.
 */
class CombinedLayer implements VectorTileLayerLike {
    version = 2;
    extent = EXTENT;
    name: string;
    features: VectorTileFeatureLike[];

    constructor(name: string, features: VectorTileFeatureLike[]) {
        this.name = name;
        this.features = features;
    }

    get length(): number {
        return this.features.length;
    }

    feature(i: number): VectorTileFeatureLike {
        return this.features[i];
    }
}

/**
 * A layer's features, at {@link EXTENT}, the extent a combined tile is encoded at.
 */
export function featuresOf(layer: VectorTileLayerLike): VectorTileFeatureLike[] {
    const features: VectorTileFeatureLike[] = [];
    for (let i = 0; i < layer.length; i++) {
        features.push(atExtent(layer.feature(i)));
    }
    return features;
}

/**
 * A feature with its geometry scaled to {@link EXTENT}, as the layers of an encoded tile have one
 * extent for all their features.
 */
function atExtent(feature: VectorTileFeatureLike): VectorTileFeatureLike {
    if (feature.extent === EXTENT) return feature;
    const scale = EXTENT / feature.extent;
    return {
        type: feature.type,
        id: feature.id,
        properties: feature.properties,
        extent: EXTENT,
        loadGeometry: () => feature.loadGeometry().map(ring => ring.map(point => new Point(Math.round(point.x * scale), Math.round(point.y * scale)))),
    };
}

/**
 * A combined tile's data, from its layers' features, or null if it has none.
 */
export function combined(layers: Map<string, VectorTileFeatureLike[]>): VectorTileData | null {
    const tile: VectorTileLike = {layers: {}};
    for (const [name, features] of layers) {
        if (features.length > 0) tile.layers[name] = new CombinedLayer(name, features);
    }
    return Object.keys(tile.layers).length > 0 ? {vectorTile: tile} : null;
}

/**
 * The part of a tile at a source's maxzoom that a tile beyond it covers, in the layers the style
 * draws from the source.
 */
function overzoomed(tile: VectorTileLike, layerIndex: StyleLayerIndex, source: string, maxZoomTileID: CanonicalTileID, tileID: CanonicalTileID): VectorTileLike {
    const result = new VectorTileOverzoomed();
    for (const sourceLayerId in layerIndex.familiesBySource[source]) {
        const layer = tile.layers[sourceLayerId];
        if (!layer) continue;
        const sliced = sliceVectorTileLayer(layer, maxZoomTileID, tileID);
        if (sliced.length > 0) result.addLayer(sliced);
    }
    return result;
}

/**
 * An operand's tile's data: a `vector` operand's decoded from its fetched data, and overzoomed
 * beyond its maxzoom, keeping the data as fetched when it is MVT and the tile as it was fetched;
 * any other operand's as its worker source gives it.
 */
export function operandTile(operand: CombinatorOperand, params: CombinatorTileParameters, layerIndex: StyleLayerIndex): VectorTileData | null {
    if (operand.leaf === undefined) return operand.workerSource.loadVectorTile(params);

    const leafParams = params.leaves[operand.leaf];
    const data = params.leafData?.[operand.leaf];
    if (!leafParams || !data) return null;
    const request = leafParams.overzoomParameters?.overzoomRequest ?? leafParams.request;
    const tileData = operand.workerSource.loadVectorTile({...params, request, encoding: operand.encoding}, data);
    if (!tileData) return null;
    const {overzoomParameters} = leafParams;
    if (overzoomParameters) {
        return {vectorTile: overzoomed(tileData.vectorTile, layerIndex, params.source, overzoomParameters.maxZoomTileID, params.tileID.canonical)};
    }
    return operand.encoding === 'mlt' ? {vectorTile: tileData.vectorTile} : {vectorTile: tileData.vectorTile, rawData: data};
}

/**
 * The context a combinator source's worker source builds its operands in.
 */
export type CombinatorContext = {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: string[];
    /** The id of the combinator source the operands are of. */
    source: string;
};

/**
 * The operand a definition describes, with the worker source of its type, given its definition.
 */
export async function createOperand(definition: CombinatorDefinition, context: CombinatorContext): Promise<CombinatorOperand> {
    const {actor, layerIndex, availableImages, source} = context;
    if (definition.type === 'vector') {
        return {workerSource: new VectorTileWorkerSource(actor, layerIndex, availableImages), leaf: definition.leaf, encoding: definition.encoding};
    }
    const workerSource = definition.type === 'geojson-layers' ? new GeoJSONLayersWorkerSource(actor, layerIndex, availableImages)
        : definition.type === 'union' ? new UnionWorkerSource(actor, layerIndex, availableImages)
            : new DifferenceWorkerSource(actor, layerIndex, availableImages);
    await workerSource.setDefinition({type: definition.type, source, definition});
    return {workerSource};
}

/**
 * What the tile lifecycle functions of this module need of a combinator source's worker source.
 */
export type CombinatorWorkerSourceState = CombinableWorkerSource & {
    actor: IActor;
    layerIndex: StyleLayerIndex;
    availableImages: string[];
    tileState: WorkerTileState;
};

/**
 * Loads a tile of a combinator source's worker source: fetches its `vector` operands' tiles,
 * evaluates the source's `loadVectorTile` on them, and parses the result. The result goes to the
 * main thread encoded as MVT: as fetched, for a fetched MVT tile that no combinator changed, and
 * encoded otherwise.
 */
export async function loadCombinedWorkerTile(source: CombinatorWorkerSourceState, params: CombinatorTileParameters): Promise<WorkerTileResult | null> {
    const {uid} = params;
    const workerTile = new WorkerTile(params);
    source.tileState.startLoading(uid, workerTile);
    const abortController = new AbortController();
    workerTile.abort = abortController;
    try {
        const leafData = await Promise.all(params.leaves.map(async leafParams => {
            if (!leafParams) return null;
            const request = leafParams.overzoomParameters?.overzoomRequest ?? leafParams.request;
            return (await getArrayBuffer(request, abortController)).data;
        }));
        const tileData = source.loadVectorTile({...params, leafData} as CombinatorTileParameters);
        source.tileState.finishLoading(uid);
        if (!tileData) return null;

        workerTile.vectorTile = tileData.vectorTile;
        source.tileState.markLoaded(uid, workerTile);
        source.tileState.setParsing(uid, {rawData: tileData.rawData ?? fromVectorTileJs(tileData.vectorTile, JSON_PREFIX).buffer});
        return await parseCombinedWorkerTile(source, workerTile, params);
    } catch (err) {
        source.tileState.finishLoading(uid);
        source.tileState.markLoaded(uid, workerTile);
        throw err;
    }
}

async function parseCombinedWorkerTile(source: CombinatorWorkerSourceState, workerTile: WorkerTile, params: WorkerTileParameters): Promise<WorkerTileResult> {
    const parseState = source.tileState.getParsing(workerTile.uid);
    const {layerIndex, availableImages, actor} = source;
    let result = await workerTile.parse(workerTile.vectorTile, layerIndex, availableImages, actor, params.subdivisionGranularity);
    if (parseState) {
        result = extend({rawTileData: parseState.rawData.slice(0), encoding: 'mvt'}, result);
        source.tileState.removeParsing(workerTile.uid);
    }
    return result;
}

/**
 * Parses a loaded tile of a combinator source's worker source again, and loads one that is not
 * loaded, such as after the source's definition has changed.
 */
export async function reloadCombinedWorkerTile(source: CombinatorWorkerSourceState, params: CombinatorTileParameters): Promise<WorkerTileResult> {
    const workerTile = source.tileState.getLoaded(params.uid);
    if (!workerTile) return loadCombinedWorkerTile(source, params);
    if (!workerTile.vectorTile) return;
    workerTile.showCollisionBoxes = params.showCollisionBoxes;
    return parseCombinedWorkerTile(source, workerTile, params);
}

import {ErrorEvent, type Evented} from '../util/evented.ts';
import {MapSourceDataEvent, type SourceEventType} from '../ui/events.ts';
import {ensureError, extend} from '../util/util.ts';
import {EXTENT} from '../data/extent.ts';
import {ResourceType} from '../util/request_manager.ts';
import {isAbortError} from '../util/abort_error.ts';
import {MessageType} from '../util/actor_messages.ts';
import {loadTileJson} from './load_tilejson.ts';

import type {Source} from './source.ts';
import type {Map} from '../ui/map.ts';
import type {Tile} from '../tile/tile.ts';
import type {Actor} from '../util/actor.ts';
import type {CanonicalTileID} from '../tile/tile_id.ts';
import type {PromoteIdSpecification, VectorSourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {TileEncoding} from './worker_source.ts';
import type {CombinatorDefinition, CombinatorLeafParameters, CombinatorTileParameters} from './combinator_worker.ts';
import type {GeoJSONLayersSourceSpecification} from './geojson_layers_source.ts';
import type {UnionSourceSpecification} from './union_source.ts';
import type {DifferenceSourceSpecification} from './difference_source.ts';

/**
 * A source that can be an operand of a source combinator.
 */
export type CombinableSourceSpecification =
    | VectorSourceSpecification
    | GeoJSONLayersSourceSpecification
    | UnionSourceSpecification
    | DifferenceSourceSpecification;

/**
 * The definition of a source combinator, or of GeoJSON by layer.
 */
export type CombinatorSourceSpecification = GeoJSONLayersSourceSpecification | UnionSourceSpecification | DifferenceSourceSpecification;

/** The maximum zoom GeoJSON is tiled at when nothing says otherwise, as for a `geojson` source. */
export const DEFAULT_GEOJSON_MAXZOOM = 18;

/**
 * A `vector` operand of a combinator source, with what its TileJSON says once it is loaded.
 */
export type VectorLeaf = {
    specification: VectorSourceSpecification;
    tiles?: string[];
    minzoom: number;
    maxzoom: number;
    scheme: string;
    encoding?: TileEncoding;
};

/**
 * What the functions of this module share of the `geojson-layers`, `union` and `difference`
 * sources: each source's tiles are computed by its worker source from its definition and the
 * tiles of its `vector` operands, its leaves.
 */
export type CombinatorSourceLike = Source & Evented<SourceEventType> & {
    promoteId: PromoteIdSpecification;
    map: Map;
    actorPromise: Promise<Actor>;
    _leaves: VectorLeaf[];
    _definition: CombinatorDefinition;
    _request: AbortController;
    _loaded: boolean;
};

/**
 * The definition a source's worker source evaluates, numbering its `vector` operands in `leaves`.
 */
export function toDefinition(specification: CombinableSourceSpecification, leaves: VectorLeaf[], id: string, tileSize: number): CombinatorDefinition {
    switch (specification.type) {
        case 'vector':
            leaves.push({specification, minzoom: 0, maxzoom: 22, scheme: 'xyz'});
            return {type: 'vector', leaf: leaves.length - 1, encoding: specification.encoding};
        case 'geojson-layers':
            return {
                type: 'geojson-layers',
                data: specification.data,
                geojsonVtOptions: {
                    buffer: (specification.buffer ?? 128) * EXTENT / tileSize,
                    tolerance: (specification.tolerance ?? 0.375) * EXTENT / tileSize,
                    extent: EXTENT,
                    maxZoom: specification.maxzoom,
                },
            };
        case 'union':
            return {type: 'union', sources: specification.sources.map(source => toDefinition(source, leaves, id, tileSize))};
        case 'difference':
            return {
                type: 'difference',
                source: toDefinition(specification.source, leaves, id, tileSize),
                subtract: toDefinition(specification.subtract, leaves, id, tileSize),
                key: specification.key,
            };
        default:
            throw new Error(`sources.${id}: a source of type "${(specification as {type: string}).type}" cannot be combined`);
    }
}

/**
 * Tiles the GeoJSON of a definition up to the source's maxzoom where it does not say otherwise.
 */
function setGeoJSONMaxZoom(definition: CombinatorDefinition, maxzoom: number): void {
    switch (definition.type) {
        case 'geojson-layers':
            definition.geojsonVtOptions.maxZoom ??= maxzoom;
            return;
        case 'union':
            for (const source of definition.sources) setGeoJSONMaxZoom(source, maxzoom);
            return;
        case 'difference':
            setGeoJSONMaxZoom(definition.source, maxzoom);
            setGeoJSONMaxZoom(definition.subtract, maxzoom);
    }
}

/**
 * Loads the TileJSON of a source's `vector` operands, which sets the source's zoom range, and
 * gives the source's worker source its definition.
 */
export async function loadCombinator(source: CombinatorSourceLike): Promise<void> {
    source._loaded = false;
    source.fire(new MapSourceDataEvent('dataloading'));
    source._request = new AbortController();
    try {
        await Promise.all(source._leaves.map(async leaf => {
            const tileJSON = await loadTileJson(leaf.specification, source.map._requestManager, source._request, source.map._ownerWindow);
            if (tileJSON) extend(leaf, tileJSON);
        }));
        if (source._leaves.length > 0) {
            source.minzoom = Math.min(...source._leaves.map(leaf => leaf.minzoom));
            source.maxzoom = Math.max(...source._leaves.map(leaf => leaf.maxzoom));
        }
        setGeoJSONMaxZoom(source._definition, source.maxzoom);
        await (await source.actorPromise).sendAsync({type: MessageType.setCombinatorDefinition, data: {type: source.type, source: source.id, definition: source._definition}});
        source._request = null;
        source._loaded = true;
        source.fire(new MapSourceDataEvent('data', {sourceDataType: 'metadata'}));
        source.fire(new MapSourceDataEvent('data', {sourceDataType: 'content'}));
    } catch (err) {
        source._request = null;
        source._loaded = true;
        if (!isAbortError(err)) source.fire(new ErrorEvent(ensureError(err)));
    }
}

/**
 * Stops loading a source's TileJSON, and has its worker source removed.
 */
export function removeCombinator(source: CombinatorSourceLike): void {
    source._request?.abort();
    source._request = null;
    source.actorPromise.then(actor => actor.sendAsync({type: MessageType.removeSource, data: {type: source.type, source: source.id}}));
}

/**
 * What each `vector` operand is to load for a tile: the tile, or the tile at its maxzoom that it
 * is overzoomed from, or nothing below its minzoom.
 */
async function leafParameters(source: CombinatorSourceLike, tile: Tile): Promise<CombinatorLeafParameters[]> {
    const {map} = source;
    const {canonical} = tile.tileID;
    const requestFor = (tileID: CanonicalTileID, leaf: VectorLeaf) => map._requestManager.transformRequest(
        tileID.url(leaf.tiles, map.getPixelRatio(), leaf.scheme, map.style.projection.worldCoordinateHelper.tileMatrixSet),
        ResourceType.Tile
    );
    return Promise.all(source._leaves.map(async (leaf): Promise<CombinatorLeafParameters> => {
        if (!leaf.tiles || canonical.z < leaf.minzoom) return null;
        if (canonical.z <= leaf.maxzoom) return {request: await requestFor(canonical, leaf)};
        const maxZoomTileID = tile.tileID.scaledTo(leaf.maxzoom).canonical;
        const overzoomRequest = await requestFor(maxZoomTileID, leaf);
        return {request: overzoomRequest, overzoomParameters: {maxZoomTileID, overzoomRequest}};
    }));
}

/**
 * Has a source's worker source load a tile, with the requests for its `vector` operands' tiles.
 */
export async function loadCombinedTile(source: CombinatorSourceLike, tile: Tile): Promise<void> {
    const message = !tile.actor ? MessageType.loadTile : MessageType.reloadTile;
    tile.actor = await source.actorPromise;
    const {map} = source;
    const params: CombinatorTileParameters = {
        type: source.type,
        uid: tile.uid,
        tileID: tile.tileID,
        zoom: tile.tileID.overscaledZ,
        maxZoom: source.maxzoom,
        tileSize: source.tileSize,
        source: source.id,
        pixelRatio: map.getPixelRatio(),
        showCollisionBoxes: map.showCollisionBoxes,
        promoteId: source.promoteId,
        subdivisionGranularity: map.style.projection.subdivisionGranularity,
        leaves: await leafParameters(source, tile),
    };

    tile.abortController = new AbortController();
    try {
        const data = await tile.actor.sendAsync({type: message, data: params}, tile.abortController);
        delete tile.abortController;
        tile.unloadVectorData();
        if (!tile.aborted) {
            tile.loadVectorData(data, map.style, message === MessageType.reloadTile);
        }
    } catch (err) {
        delete tile.abortController;
        if (tile.aborted || isAbortError(err)) return;
        throw err;
    }
}

export async function abortCombinedTile(tile: Tile): Promise<void> {
    tile.abortController?.abort();
    delete tile.abortController;
    tile.aborted = true;
}

export async function unloadCombinedTile(source: CombinatorSourceLike, tile: Tile): Promise<void> {
    tile.unloadVectorData();
    await (await source.actorPromise).sendAsync({type: MessageType.removeTile, data: {uid: tile.uid, type: source.type, source: source.id}});
}

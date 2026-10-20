import {Evented} from '../util/evented.ts';
import {extend} from '../util/util.ts';
import {abortCombinedTile, DEFAULT_GEOJSON_MAXZOOM, loadCombinator, loadCombinedTile, removeCombinator, toDefinition, unloadCombinedTile} from './combinator.ts';

import type {Source} from './source.ts';
import type {Map} from '../ui/map.ts';
import type {Dispatcher} from '../util/dispatcher.ts';
import type {Tile} from '../tile/tile.ts';
import type {Actor} from '../util/actor.ts';
import type {SourceEventType} from '../ui/events.ts';
import type {PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {VectorLeaf} from './combinator.ts';
import type {CombinatorDefinition} from './combinator_worker.ts';

/**
 * GeoJSON by layer: a source whose tiles have a layer for each member of `data`, holding that
 * member's features, as a vector tile source's tiles have layers. Style layers draw it by
 * `source-layer`.
 */
export type GeoJSONLayersSourceSpecification = {
    type: 'geojson-layers';
    /** The GeoJSON of each layer, keyed by the layer's name. */
    data: Record<string, GeoJSON.GeoJSON>;
    /** The maximum zoom the GeoJSON is tiled at; by default that of the source it is combined with, or 18. */
    maxzoom?: number;
    /** As for a `geojson` source. */
    buffer?: number;
    /** As for a `geojson` source. */
    tolerance?: number;
    promoteId?: PromoteIdSpecification;
    attribution?: string;
};

/**
 * The source of the `geojson-layers` source type, GeoJSON by layer
 * ({@link GeoJSONLayersSourceSpecification}), which can also be an operand of the `union` and
 * `difference` source types.
 *
 * @example
 * ```ts
 * map.addSource('overlay', {
 *     type: 'geojson-layers',
 *     data: {
 *         tracks: {type: 'FeatureCollection', features: [...]},
 *         stations: {type: 'FeatureCollection', features: [...]}
 *     }
 * });
 * ```
 */
export class GeoJSONLayersSource extends Evented<SourceEventType> implements Source {
    type: 'geojson-layers';
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    promoteId: PromoteIdSpecification;
    attribution: string;
    isTileClipped: boolean;
    reparseOverscaled: boolean;

    dispatcher: Dispatcher;
    map: Map;
    actorPromise: Promise<Actor>;
    _options: GeoJSONLayersSourceSpecification;
    _leaves: VectorLeaf[];
    _definition: CombinatorDefinition;
    _request: AbortController;
    _loaded: boolean;

    constructor(id: string, options: GeoJSONLayersSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'geojson-layers';
        this.dispatcher = dispatcher;
        this.minzoom = 0;
        this.maxzoom = options.maxzoom ?? DEFAULT_GEOJSON_MAXZOOM;
        this.tileSize = 512;
        this.isTileClipped = true;
        this.reparseOverscaled = true;
        this.promoteId = options.promoteId;
        this.attribution = options.attribution;
        this._options = extend({}, options);
        this._leaves = [];
        this._definition = toDefinition(options, this._leaves, id, this.tileSize);
        this._loaded = false;
        this.actorPromise = dispatcher.getActor();
        this.setEventedParent(eventedParent);
    }

    load(): Promise<void> {
        return loadCombinator(this);
    }

    loaded(): boolean {
        return this._loaded;
    }

    onAdd(map: Map): void {
        this.map = map;
        this.load();
    }

    onRemove(): void {
        removeCombinator(this);
    }

    serialize(): GeoJSONLayersSourceSpecification {
        return extend({}, this._options);
    }

    hasTransition(): boolean {
        return false;
    }

    loadTile(tile: Tile): Promise<void> {
        return loadCombinedTile(this, tile);
    }

    abortTile(tile: Tile): Promise<void> {
        return abortCombinedTile(tile);
    }

    unloadTile(tile: Tile): Promise<void> {
        return unloadCombinedTile(this, tile);
    }
}

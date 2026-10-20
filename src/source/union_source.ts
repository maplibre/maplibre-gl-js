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
import type {CombinableSourceSpecification, VectorLeaf} from './combinator.ts';
import type {CombinatorDefinition} from './combinator_worker.ts';

/**
 * The union of sources: each layer of its tiles holds the features of that layer of all of
 * `sources`' tiles.
 */
export type UnionSourceSpecification = {
    type: 'union';
    sources: CombinableSourceSpecification[];
    promoteId?: PromoteIdSpecification;
    attribution?: string;
};

/**
 * The source of the `union` source type ({@link UnionSourceSpecification}). Its operands are
 * `vector` sources, `geojson-layers`, or other `union` and `difference` sources, given inline.
 *
 * The source's worker source gets each operand's tile and combines them before parsing, so a
 * combined tile is drawn, hovered and queried like any vector tile. Its zoom range is that of its
 * `vector` operands, which are each overzoomed beyond their own maxzoom.
 *
 * @example
 * ```ts
 * map.addSource('railways', {
 *     type: 'union',
 *     sources: [
 *         {
 *             type: 'difference',
 *             source: {type: 'vector', url: 'https://example.com/railways.json'},
 *             subtract: {type: 'geojson-layers', data: {tracks: {type: 'FeatureCollection', features: [{type: 'Feature', id: 123, properties: {}, geometry: null}]}}}
 *         },
 *         {type: 'geojson-layers', data: {tracks: {type: 'FeatureCollection', features: [...]}}}
 *     ]
 * });
 * ```
 */
export class UnionSource extends Evented<SourceEventType> implements Source {
    type: 'union';
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
    _options: UnionSourceSpecification;
    _leaves: VectorLeaf[];
    _definition: CombinatorDefinition;
    _request: AbortController;
    _loaded: boolean;

    constructor(id: string, options: UnionSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'union';
        this.dispatcher = dispatcher;
        this.minzoom = 0;
        this.maxzoom = DEFAULT_GEOJSON_MAXZOOM;
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

    serialize(): UnionSourceSpecification {
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

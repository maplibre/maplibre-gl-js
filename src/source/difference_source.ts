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
import type {CombinatorDefinition, DifferenceKey} from './combinator_worker.ts';

/**
 * The difference of two sources: each layer of its tiles holds the features of that layer of
 * `source`'s tiles but those whose key is the id of a feature of that layer of `subtract`.
 * `subtract` is `geojson-layers` or a `union` of them, whose features are all at hand, so a
 * feature is subtracted wherever it is, even by a feature without a geometry. A feature's key is
 * given by `key`, an expression evaluated on it, the same for every layer or by layer; by default,
 * or for a layer it does not name, the feature id.
 */
export type DifferenceSourceSpecification = {
    type: 'difference';
    source: CombinableSourceSpecification;
    subtract: CombinableSourceSpecification;
    key?: DifferenceKey;
    promoteId?: PromoteIdSpecification;
    attribution?: string;
};

/**
 * The source of the `difference` source type ({@link DifferenceSourceSpecification}). Its
 * operands are `vector` sources, `geojson-layers`, or `union` and other `difference` sources,
 * given inline.
 *
 * The source's worker source gets each operand's tile and combines them before parsing, so a
 * combined tile is drawn, hovered and queried like any vector tile. Its zoom range is that of its
 * `vector` operands, which are each overzoomed beyond their own maxzoom.
 *
 * @example
 * ```ts
 * map.addSource('railways', {
 *     type: 'difference',
 *     source: {type: 'vector', url: 'https://example.com/railways.json'},
 *     subtract: {type: 'geojson-layers', data: {tracks: {type: 'FeatureCollection', features: [{type: 'Feature', id: 123, properties: {}, geometry: null}]}}}
 * });
 * ```
 */
export class DifferenceSource extends Evented<SourceEventType> implements Source {
    type: 'difference';
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
    _options: DifferenceSourceSpecification;
    _leaves: VectorLeaf[];
    _definition: CombinatorDefinition;
    _request: AbortController;
    _loaded: boolean;

    constructor(id: string, options: DifferenceSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'difference';
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

    serialize(): DifferenceSourceSpecification {
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

import {Event, ErrorEvent, Evented} from '../util/evented';

import {extend, pick} from '../util/util';
import {loadTileJson} from './load_tilejson';
import {TileBounds} from './tile_bounds';
import {ResourceType} from '../util/request_manager';

import type {Source} from './source';
import type {OverscaledTileID} from './tile_id';
import type {Map} from '../ui/map';
import type {Dispatcher} from '../util/dispatcher';
import type {Tile} from './tile';
import type {VectorSourceSpecification, PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {WorkerTileResult} from './worker_source';
import {MessageType} from '../util/actor_messages';

export type VectorTileSourceOptions = VectorSourceSpecification & {
    collectResourceTiming?: boolean;
    tileSize?: number;
}

/**
 * A source containing vector tiles in [Mapbox Vector Tile format](https://docs.mapbox.com/vector-tiles/reference/).
 * (See the [Style Specification](https://maplibre.org/maplibre-style-spec/) for detailed documentation of options.)
 *
 * @group Sources
 *
 * @example
 * ```ts
 * map.addSource('some id', {
 *     type: 'vector',
 *     url: 'https://demotiles.maplibre.org/tiles/tiles.json'
 * });
 * ```
 *
 * @example
 * ```ts
 * map.addSource('some id', {
 *     type: 'vector',
 *     tiles: ['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt'],
 *     minzoom: 6,
 *     maxzoom: 14
 * });
 * ```
 *
 * @example
 * ```ts
 * map.getSource('some id').setUrl("https://demotiles.maplibre.org/tiles/tiles.json");
 * ```
 *
 * @example
 * ```ts
 * map.getSource('some id').setTiles(['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt']);
 * ```
 * @see [Add a vector tile source](https://maplibre.org/maplibre-gl-js/docs/examples/vector-source/)
 */
export class VectorTileSource extends Evented implements Source {
    type: 'vector';
    id: string;
    minzoom: number;
    maxzoom: number;
    url: string;
    scheme: string;
    tileSize: number;
    promoteId: PromoteIdSpecification;

    _options: VectorSourceSpecification;
    _collectResourceTiming: boolean;
    dispatcher: Dispatcher;
    map: Map;
    bounds: [number, number, number, number];
    tiles: Array<string>;
    tileBounds: TileBounds;
    reparseOverscaled: boolean;
    isTileClipped: boolean;
    _tileJSONRequest: AbortController;
    _loaded: boolean;

    constructor(id: string, options: VectorTileSourceOptions, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;

        this.type = 'vector';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.scheme = 'xyz';
        this.tileSize = 512;
        this.reparseOverscaled = true;
        this.isTileClipped = true;
        this._loaded = false;

        extend(this, pick(options, ['url', 'scheme', 'tileSize', 'promoteId']));
        this._options = extend({type: 'vector'}, options);

        this._collectResourceTiming = options.collectResourceTiming;

        if (this.tileSize !== 512) {
            throw new Error('vector tile sources must have a tileSize of 512');
        }

        this.setEventedParent(eventedParent);
    }

    async load() {
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));
        this._tileJSONRequest = new AbortController();
        try {
            const tileJSON = await loadTileJson(this._options, this.map._requestManager, this._tileJSONRequest);
            this._tileJSONRequest = null;
            this._loaded = true;
            this.map.style.sourceCaches[this.id].clearTiles();
            if (tileJSON) {
                extend(this, tileJSON);
                if (tileJSON.bounds) this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);

                // `content` is included here to prevent a race condition where `Style#_updateSources` is called
                // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
                // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        } catch (err) {
            this._tileJSONRequest = null;
            this.fire(new ErrorEvent(err));
        }
    }

    loaded(): boolean {
        return this._loaded;
    }

    hasTile(tileID: OverscaledTileID) {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    setSourceProperty(callback: Function) {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.abort();
        }

        callback();

        this.load();
    }

    /**
     * Sets the source `tiles` property and re-renders the map.
     *
     * @param tiles - An array of one or more tile source URLs, as in the TileJSON spec.
     */
    setTiles(tiles: Array<string>): this {
        this.setSourceProperty(() => {
            this._options.tiles = tiles;
        });

        return this;
    }

    /**
     * Sets the source `url` property and re-renders the map.
     *
     * @param url - A URL to a TileJSON resource. Supported protocols are `http:` and `https:`.
     */
    setUrl(url: string): this {
        this.setSourceProperty(() => {
            this.url = url;
            this._options.url = url;
        });

        return this;
    }

    onRemove() {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.abort();
            this._tileJSONRequest = null;
        }
    }

    serialize(): VectorSourceSpecification {
        return extend({}, this._options);
    }

    async loadTile(tile: Tile): Promise<void> {
        const url = tile.tileID.canonical.url(this.tiles, this.map.getPixelRatio(), this.scheme);
        const params = {
            request: this.map._requestManager.transformRequest(url, ResourceType.Tile),
            uid: tile.uid,
            tileID: tile.tileID,
            zoom: tile.tileID.overscaledZ,
            tileSize: this.tileSize * tile.tileID.overscaleFactor(),
            type: this.type,
            source: this.id,
            pixelRatio: this.map.getPixelRatio(),
            showCollisionBoxes: this.map.showCollisionBoxes,
            promoteId: this.promoteId
        };
        params.request.collectResourceTiming = this._collectResourceTiming;
        let messageType: MessageType.loadTile | MessageType.reloadTile = MessageType.reloadTile;
        if (!tile.actor || tile.state === 'expired') {
            tile.actor = this.dispatcher.getActor();
            messageType = MessageType.loadTile;
        } else if (tile.state === 'loading') {
            return new Promise<void>((resolve, reject) => {
                tile.reloadPromise = {resolve, reject};
            });
        }
        tile.abortController = new AbortController();
        try {
            const data = await tile.actor.sendAsync({type: messageType, data: params}, tile.abortController);
            delete tile.abortController;

            if (tile.aborted) {
                return;
            }
            this._afterTileLoadWorkerResponse(tile, data);
        } catch (err) {
            delete tile.abortController;

            if (tile.aborted) {
                return;
            }
            if (err && err.status !== 404) {
                throw err;
            }
            this._afterTileLoadWorkerResponse(tile, null);
        }
    }

    private _afterTileLoadWorkerResponse(tile: Tile, data: WorkerTileResult) {
        if (data && data.resourceTiming) {
            tile.resourceTiming = data.resourceTiming;
        }

        if (data && this.map._refreshExpiredTiles) {
            tile.setExpiryData(data);
        }
        tile.loadVectorData(data, this.map.painter);

        if (tile.reloadPromise) {
            const reloadPromise = tile.reloadPromise;
            tile.reloadPromise = null;
            this.loadTile(tile).then(reloadPromise.resolve).catch(reloadPromise.reject);
        }
    }

    async abortTile(tile: Tile): Promise<void> {
        if (tile.abortController) {
            tile.abortController.abort();
            delete tile.abortController;
        }
        if (tile.actor) {
            await tile.actor.sendAsync({
                type: MessageType.abortTile,
                data: {uid: tile.uid, type: this.type, source: this.id}
            });
        }
    }

    async unloadTile(tile: Tile): Promise<void> {
        tile.unloadVectorData();
        if (tile.actor) {
            await tile.actor.sendAsync({
                type: MessageType.removeTile,
                data: {
                    uid: tile.uid,
                    type: this.type,
                    source: this.id}
            });
        }
    }

    hasTransition() {
        return false;
    }
}

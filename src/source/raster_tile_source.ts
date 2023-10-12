import {extend, pick} from '../util/util';

import {ImageRequest} from '../util/image_request';

import {ResourceType} from '../util/request_manager';
import {Event, ErrorEvent, Evented} from '../util/evented';
import {loadTileJson} from './load_tilejson';
import {TileBounds} from './tile_bounds';
import {Texture} from '../render/texture';

import type {Source} from './source';
import type {OverscaledTileID} from './tile_id';
import type {Map} from '../ui/map';
import type {Dispatcher} from '../util/dispatcher';
import type {Tile} from './tile';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import type {
    RasterSourceSpecification,
    RasterDEMSourceSpecification
} from '@maplibre/maplibre-gl-style-spec';

/**
 * A source containing raster tiles (See the [Style Specification](https://maplibre.org/maplibre-style-spec/) for detailed documentation of options.)
 *
 * @group Sources
 *
 * @example
 * ```ts
 * map.addSource('raster-source', {
 *     'type': 'raster',
 *     'tiles': ['https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg'],
 *     'tileSize': 256,
 * });
 * ```
 *
 * @example
 * ```ts
 * map.addSource('wms-test-source', {
 *      'type': 'raster',
 * // use the tiles option to specify a WMS tile source URL
 *      'tiles': [
 *          'https://img.nj.gov/imagerywms/Natural2015?bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857&transparent=true&width=256&height=256&layers=Natural2015'
 *      ],
 *      'tileSize': 256
 * });
 * ```
 * @see [Add a raster tile source](https://maplibre.org/maplibre-gl-js/docs/examples/map-tiles/)
 * @see [Add a WMS source](https://maplibre.org/maplibre-gl-js/docs/examples/wms/)
 * @see [Display a satellite map](https://maplibre.org/maplibre-gl-js/docs/examples/satellite-map/)
 */
export class RasterTileSource extends Evented implements Source {
    type: 'raster' | 'raster-dem';
    id: string;
    minzoom: number;
    maxzoom: number;
    url: string;
    scheme: string;
    tileSize: number;

    bounds: [number, number, number, number];
    tileBounds: TileBounds;
    roundZoom: boolean;
    dispatcher: Dispatcher;
    map: Map;
    tiles: Array<string>;

    _loaded: boolean;
    _options: RasterSourceSpecification | RasterDEMSourceSpecification;
    _tileJSONRequest: Cancelable;

    constructor(id: string, options: RasterSourceSpecification | RasterDEMSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.setEventedParent(eventedParent);

        this.type = 'raster';
        this.minzoom = 0;
        this.maxzoom = 22;
        this.roundZoom = true;
        this.scheme = 'xyz';
        this.tileSize = 512;
        this._loaded = false;

        this._options = extend({type: 'raster'}, options);
        extend(this, pick(options, ['url', 'scheme', 'tileSize']));
    }

    load() {
        this._loaded = false;
        this.fire(new Event('dataloading', {dataType: 'source'}));
        this._tileJSONRequest = loadTileJson(this._options, this.map._requestManager, (err, tileJSON) => {
            this._tileJSONRequest = null;
            this._loaded = true;
            if (err) {
                this.fire(new ErrorEvent(err));
            } else if (tileJSON) {
                extend(this, tileJSON);
                if (tileJSON.bounds) this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);

                // `content` is included here to prevent a race condition where `Style#_updateSources` is called
                // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
                // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        });
    }

    loaded(): boolean {
        return this._loaded;
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    onRemove() {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.cancel();
            this._tileJSONRequest = null;
        }
    }

    setSourceProperty(callback: Function) {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.cancel();
        }

        callback();

        this.load();
    }

    /**
     * Sets the source `tiles` property and re-renders the map.
     *
     * @param tiles - An array of one or more tile source URLs, as in the raster tiles spec (See the [Style Specification](https://maplibre.org/maplibre-style-spec/)
     * @returns `this`
     */
    setTiles(tiles: Array<string>): this {
        this.setSourceProperty(() => {
            this._options.tiles = tiles;
        });

        return this;
    }

    serialize() {
        return extend({}, this._options);
    }

    hasTile(tileID: OverscaledTileID) {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const url = tile.tileID.canonical.url(this.tiles, this.map.getPixelRatio(), this.scheme);
        tile.request = ImageRequest.getImage(this.map._requestManager.transformRequest(url, ResourceType.Tile), (err, img, expiry) => {
            delete tile.request;

            if (tile.aborted) {
                tile.state = 'unloaded';
                callback(null);
            } else if (err) {
                tile.state = 'errored';
                callback(err);
            } else if (img) {
                if (this.map._refreshExpiredTiles && expiry) tile.setExpiryData(expiry);

                const context = this.map.painter.context;
                const gl = context.gl;
                tile.texture = this.map.painter.getTileTexture(img.width);
                if (tile.texture) {
                    tile.texture.update(img, {useMipmap: true});
                } else {
                    tile.texture = new Texture(context, img, gl.RGBA, {useMipmap: true});
                    tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

                    if (context.extTextureFilterAnisotropic) {
                        gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
                    }
                }

                tile.state = 'loaded';

                callback(null);
            }
        }, this.map._refreshExpiredTiles);
    }

    abortTile(tile: Tile, callback: Callback<void>) {
        if (tile.request) {
            tile.request.cancel();
            delete tile.request;
        }
        callback();
    }

    unloadTile(tile: Tile, callback: Callback<void>) {
        if (tile.texture) this.map.painter.saveTileTexture(tile.texture);
        callback();
    }

    hasTransition() {
        return false;
    }
}

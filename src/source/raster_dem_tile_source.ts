import {ImageRequest} from '../util/image_request';
import {ResourceType} from '../util/request_manager';
import {extend, isImageBitmap, readImageUsingVideoFrame} from '../util/util';
import {type Evented} from '../util/evented';
import {browser} from '../util/browser';
import {offscreenCanvasSupported} from '../util/offscreen_canvas_supported';
import {OverscaledTileID} from './tile_id';
import {RasterTileSource} from './raster_tile_source';
// ensure DEMData is registered for worker transfer on main thread:
import '../data/dem_data';
import type {DEMEncoding} from '../data/dem_data';

import type {Source} from './source';
import type {Dispatcher} from '../util/dispatcher';
import type {Tile} from './tile';
import type {RasterDEMSourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import {isOffscreenCanvasDistorted} from '../util/offscreen_canvas_distorted';
import {RGBAImage} from '../util/image';
import {MessageType} from '../util/actor_messages';

/**
 * A source containing raster DEM tiles (See the [Style Specification](https://maplibre.org/maplibre-style-spec/) for detailed documentation of options.)
 * This source can be used to show hillshading and 3D terrain
 *
 * @group Sources
 *
 * @example
 * ```ts
 * map.addSource('raster-dem-source', {
 *      type: 'raster-dem',
 *      url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
 *      tileSize: 256
 * });
 * ```
 * @see [3D Terrain](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/)
 */
export class RasterDEMTileSource extends RasterTileSource implements Source {
    encoding: DEMEncoding;
    redFactor?: number;
    greenFactor?: number;
    blueFactor?: number;
    baseShift?: number;

    constructor(id: string, options: RasterDEMSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'raster-dem';
        this.maxzoom = 22;
        this._options = extend({type: 'raster-dem'}, options);
        this.encoding = options.encoding || 'mapbox';
        this.redFactor = options.redFactor;
        this.greenFactor = options.greenFactor;
        this.blueFactor = options.blueFactor;
        this.baseShift = options.baseShift;
    }

    override async loadTile(tile: Tile): Promise<void> {
        const url = tile.tileID.canonical.url(this.tiles, this.map.getPixelRatio(), this.scheme);
        const request = this.map._requestManager.transformRequest(url, ResourceType.Tile);
        tile.neighboringTiles = this._getNeighboringTiles(tile.tileID);
        tile.abortController = new AbortController();
        try {
            const response = await ImageRequest.getImage(request, tile.abortController, this.map._refreshExpiredTiles);
            delete tile.abortController;
            if (tile.aborted) {
                tile.state = 'unloaded';
                return;
            }
            if (response && response.data) {
                const img = response.data;
                if (this.map._refreshExpiredTiles && response.cacheControl && response.expires) {
                    tile.setExpiryData({cacheControl: response.cacheControl, expires: response.expires});
                }
                const transfer = isImageBitmap(img) && offscreenCanvasSupported();
                const rawImageData = transfer ? img : await this.readImageNow(img);
                const params = {
                    type: this.type,
                    uid: tile.uid,
                    source: this.id,
                    rawImageData,
                    encoding: this.encoding,
                    redFactor: this.redFactor,
                    greenFactor: this.greenFactor,
                    blueFactor: this.blueFactor,
                    baseShift: this.baseShift
                };

                if (!tile.actor || tile.state === 'expired') {
                    tile.actor = this.dispatcher.getActor();
                    const data = await tile.actor.sendAsync({type: MessageType.loadDEMTile, data: params});
                    tile.dem = data;
                    tile.needsHillshadePrepare = true;
                    tile.needsTerrainPrepare = true;
                    tile.state = 'loaded';
                }
            }
        } catch (err) {
            delete tile.abortController;
            if (tile.aborted) {
                tile.state = 'unloaded';
            } else if (err) {
                tile.state = 'errored';
                throw err;
            }
        }
    }

    async readImageNow(img: ImageBitmap | HTMLImageElement): Promise<RGBAImage | ImageData> {
        if (typeof VideoFrame !== 'undefined' && isOffscreenCanvasDistorted()) {
            const width = img.width + 2;
            const height = img.height + 2;
            try {
                return new RGBAImage({width, height}, await readImageUsingVideoFrame(img, -1, -1, width, height));
            } catch {
                // fall-back to browser canvas decoding
            }
        }
        return browser.getImageData(img, 1);
    }

    _getNeighboringTiles(tileID: OverscaledTileID) {
        const canonical = tileID.canonical;
        const dim = Math.pow(2, canonical.z);

        const px = (canonical.x - 1 + dim) % dim;
        const pxw = canonical.x === 0 ? tileID.wrap - 1 : tileID.wrap;
        const nx = (canonical.x + 1 + dim) % dim;
        const nxw = canonical.x + 1 === dim ? tileID.wrap + 1 : tileID.wrap;

        const neighboringTiles = {};
        // add adjacent tiles
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y).key] = {backfilled: false};
        neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y).key] = {backfilled: false};

        // Add upper neighboringTiles
        if (canonical.y > 0) {
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y - 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y - 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y - 1).key] = {backfilled: false};
        }
        // Add lower neighboringTiles
        if (canonical.y + 1 < dim) {
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y + 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y + 1).key] = {backfilled: false};
            neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y + 1).key] = {backfilled: false};
        }

        return neighboringTiles;
    }

    async unloadTile(tile: Tile) {
        if (tile.demTexture) this.map.painter.saveTileTexture(tile.demTexture);
        if (tile.fbo) {
            tile.fbo.destroy();
            delete tile.fbo;
        }
        if (tile.dem) delete tile.dem;
        delete tile.neighboringTiles;

        tile.state = 'unloaded';
        if (tile.actor) {
            await tile.actor.sendAsync({type: MessageType.removeDEMTile, data: {type: this.type, uid: tile.uid, source: this.id}});
        }
    }
}

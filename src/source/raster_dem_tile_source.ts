import {ImageRequest} from '../util/image_request.ts';
import {ResourceType} from '../util/request_manager.ts';
import {extend, isImageBitmap, readImageUsingVideoFrame} from '../util/util.ts';
import {browser} from '../util/browser.ts';
import {offscreenCanvasSupported} from '../util/offscreen_canvas_supported.ts';
import {RasterTileSource} from './raster_tile_source.ts';
import {getNeighboringTiles} from '../tile/tile_manager_raster_dem.ts';
// ensure DEMData is registered for worker transfer on main thread:
import '../data/dem_data.ts';
import {isOffscreenCanvasDistorted} from '../util/offscreen_canvas_distorted.ts';
import {RGBAImage} from '../util/image.ts';
import {MessageType} from '../util/actor_messages.ts';

import type {DEMEncoding} from '../data/dem_data.ts';
import type {Source} from './source.ts';
import type {Dispatcher} from '../util/dispatcher.ts';
import type {Tile} from '../tile/tile.ts';
import type {RasterDEMSourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Evented} from '../util/evented.ts';

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
        const url = tile.tileID.canonical.url(this.tiles, this.map.getPixelRatio(), this.scheme, this.map.style.projection.worldCoordinateHelper.tileMatrixSet);
        tile.neighboringTiles = getNeighboringTiles(tile.tileID);
        tile.abortController = new AbortController();
        try {
            const response = await ImageRequest.transformAndGetImage(this.map._requestManager, url, ResourceType.Tile, tile.abortController, this.map._refreshExpiredTiles, {colorSpaceConversion: 'none'});
            delete tile.abortController;
            if (tile.aborted) {
                tile.state = 'unloaded';
                return;
            }
            if (response) {
                if (this.map._refreshExpiredTiles && (response.cacheControl || response.expires)) {
                    tile.setExpiryData({cacheControl: response.cacheControl, expires: response.expires});
                }
                // An empty response (e.g. HTTP 204 for a missing DEM tile) carries no elevation
                // data: treat the tile as loaded without a DEM instead of building a degenerate
                // one that would fail against its neighbors in backfillBorder (#1551).
                if (!response.data) {
                    tile.state = 'loaded';
                    return;
                }
                const img = response.data;
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

                if (tile.actor && tile.state !== 'expired' && tile.state !== 'reloading') {
                    return;
                }
                await this.dispatcher.waitForInitComplete();
                if (!tile.actor || tile.state === 'expired') {
                    tile.actor = this.dispatcher.getReadyActor();
                }
                tile.dem = await tile.actor.sendAsync({type: MessageType.loadDEMTile, data: params});
                tile.needsHillshadePrepare = true;
                tile.needsTerrainPrepare = true;
                tile.needsColorReliefPrepare = true;
                tile.state = 'loaded';
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
            const width = img.width + 4;
            const height = img.height + 4;
            try {
                return new RGBAImage({width, height}, await readImageUsingVideoFrame(img, -2, -2, width, height));
            } catch {
                // fall-back to browser canvas decoding
            }
        }
        return browser.getImageData(img, 2);
    }

    async unloadTile(tile: Tile): Promise<void> {
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

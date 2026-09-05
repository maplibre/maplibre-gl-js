import {ImageRequest} from '../util/image_request.ts';
import {ResourceType} from '../util/request_manager.ts';
import {extend, isImageBitmap, readImageUsingVideoFrame} from '../util/util.ts';
import {type Evented} from '../util/evented.ts';
import {browser} from '../util/browser.ts';
import {offscreenCanvasSupported} from '../util/offscreen_canvas_supported.ts';
import {OverscaledTileID, calculateTileKey} from '../tile/tile_id.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {LngLat, type LngLatLike} from '../geo/lng_lat.ts';
import {RasterTileSource} from './raster_tile_source.ts';
// ensure DEMData is registered for worker transfer on main thread:
import '../data/dem_data.ts';
import type {DEMEncoding} from '../data/dem_data.ts';

import type {Source} from './source.ts';
import type {Dispatcher} from '../util/dispatcher.ts';
import type {Tile} from '../tile/tile.ts';
import type {RasterDEMSourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import {isOffscreenCanvasDistorted} from '../util/offscreen_canvas_distorted.ts';
import {RGBAImage} from '../util/image.ts';
import {MessageType} from '../util/actor_messages.ts';

/**
 * One result of {@link RasterDEMTileSource.queryElevations}.
 *
 * @group Sources
 */
export type ElevationQueryResult = {
    /** Elevation in meters, without terrain exaggeration */
    elevation: number;
    /** Zoom of the tile the elevation was read from */
    tileZoom: number;
};

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
        tile.neighboringTiles = this._getNeighboringTiles(tile.tileID);
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

    _getNeighboringTiles(tileID: OverscaledTileID): Record<string, {backfilled: boolean}> {
        const canonical = tileID.canonical;
        const dim = Math.pow(2, canonical.z);

        const px = (canonical.x - 1 + dim) % dim;
        const pxw = canonical.x === 0 ? tileID.wrap - 1 : tileID.wrap;
        const nx = (canonical.x + 1 + dim) % dim;
        const nxw = canonical.x + 1 === dim ? tileID.wrap + 1 : tileID.wrap;

        const neighboringTiles: Record<string, {backfilled: boolean}> = {};
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

    /**
     * Returns the elevation at each location from the DEM tiles this source has already loaded.
     * The highest loaded zoom at a location wins and terrain exaggeration is not applied.
     * A location with no loaded tile, or a source that is not on a map yet, gets `null`.
     * @param lngLats - the locations to query
     * @returns one result per location, in the same order
     * @example
     * ```ts
     * const dem = map.getSource('dem') as RasterDEMTileSource;
     * const [result] = dem.queryElevations([map.getCenter()]);
     * ```
     */
    queryElevations(lngLats: LngLatLike[]): Array<ElevationQueryResult | null> {
        const tileManager = this.map?.style?.tileManagers[this.id];
        if (!tileManager) {
            return lngLats.map(() => null);
        }

        return lngLats.map((lngLatLike) => {
            const mercator = MercatorCoordinate.fromLngLat(LngLat.convert(lngLatLike).wrap());
            // keep the location strictly inside the world so it always falls in a tile, poles included
            const mx = Math.max(0, Math.min(1 - 1e-15, mercator.x));
            const my = Math.max(0, Math.min(1 - 1e-15, mercator.y));

            for (let z = this.maxzoom; z >= this.minzoom; z--) {
                const tileCount = 1 << z;
                const tileX = Math.floor(mx * tileCount);
                const tileY = Math.floor(my * tileCount);
                // raster-dem tiles are never overscaled, so overscaledZ is the canonical z
                const key = calculateTileKey(0, z, z, tileX, tileY);
                const tile = tileManager.getTileByID(key) ?? tileManager._outOfViewCache.getByKey(key);
                if (!tile?.dem) continue;

                const fx = mx * tileCount - tileX;
                const fy = my * tileCount - tileY;
                return {
                    elevation: tile.dem.sampleBilinear(fx * tile.dem.dim, fy * tile.dem.dim),
                    tileZoom: z
                };
            }

            return null;
        });
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

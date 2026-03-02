import {ImageRequest} from '../util/image_request';
import {ResourceType} from '../util/request_manager';
import {extend, isImageBitmap, readImageUsingVideoFrame} from '../util/util';
import {type Evented} from '../util/evented';
import {browser} from '../util/browser';
import {offscreenCanvasSupported} from '../util/offscreen_canvas_supported';
import {OverscaledTileID, calculateTileKey} from '../tile/tile_id';
import {RasterTileSource} from './raster_tile_source';
import {MercatorCoordinate} from '../geo/mercator_coordinate';
import {LngLat} from '../geo/lng_lat';
// ensure DEMData is registered for worker transfer on main thread:
import '../data/dem_data';
import type {DEMEncoding, DEMData} from '../data/dem_data';

import type {LngLatLike} from '../geo/lng_lat';
import type {Source} from './source';
import type {Dispatcher} from '../util/dispatcher';
import type {Tile} from '../tile/tile';
import type {RasterDEMSourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import {isOffscreenCanvasDistorted} from '../util/offscreen_canvas_distorted';
import {RGBAImage} from '../util/image';
import {MessageType} from '../util/actor_messages';

/**
 * The result of an elevation query from a raster DEM source.
 *
 * @group Sources
 */
export type ElevationQueryResult = {
    /** Elevation in meters above sea level (raw, without terrain exaggeration). */
    elevation: number;
    /** Zoom level of the tile that provided the elevation data. */
    tileZoom: number;
};

/**
 * Bilinear interpolation of a DEM tile at fractional tile coordinates.
 * @param dem - The DEM data to sample
 * @param fx - Fractional x position within the tile, in [0, 1)
 * @param fy - Fractional y position within the tile, in [0, 1)
 */
function sampleDEMBilinear(dem: DEMData, fx: number, fy: number): number {
    const px = fx * dem.dim;
    const py = fy * dem.dim;
    const x0 = Math.min(Math.floor(px), dem.dim - 1);
    const y0 = Math.min(Math.floor(py), dem.dim - 1);
    const tx = px - x0;
    const ty = py - y0;
    return (
        dem.get(x0, y0) * (1 - tx) * (1 - ty) +
        dem.get(x0 + 1, y0) * tx * (1 - ty) +
        dem.get(x0, y0 + 1) * (1 - tx) * ty +
        dem.get(x0 + 1, y0 + 1) * tx * ty
    );
}

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
                if (this.map._refreshExpiredTiles && (response.cacheControl || response.expires)) {
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
     * Query elevation at one or more geographic coordinates using already-loaded DEM tiles.
     *
     * Returns raw elevation in meters above sea level, without terrain exaggeration.
     * For each coordinate, the method searches loaded tiles from the highest available
     * zoom level down to the lowest, returning the best-resolution elevation available.
     *
     * Returns `null` for coordinates where no DEM tile is currently loaded.
     *
     * @param lnglats - Array of geographic coordinates to query.
     * @returns Array of elevation results (or `null` where no data is available),
     *   in the same order as the input coordinates.
     *
     * @example
     * ```ts
     * const demSource = map.getSource('terrain-dem') as RasterDEMTileSource;
     * const results = demSource.queryElevations([[7.0, 45.0], [7.1, 45.1]]);
     * const missing = results.filter(r => r === null).length;
     * if (missing > 0) console.log(`${missing} points have no loaded tile`);
     * results.forEach((r, i) => {
     *     if (r) console.log(`Point ${i}: ${r.elevation}m (zoom ${r.tileZoom})`);
     * });
     * ```
     */
    queryElevations(
        lnglats: LngLatLike[]
    ): (ElevationQueryResult | null)[] {
        if (!this.map) {
            throw new Error('Source is not added to a map');
        }

        const tileManager = this.map.style?.tileManagers[this.id];
        if (!tileManager) {
            throw new Error(`No tile manager found for source "${this.id}"`);
        }

        return lnglats.map(ll => {
            const lnglat = LngLat.convert(ll).wrap();
            const mercator = MercatorCoordinate.fromLngLat(lnglat);
            const mx = Math.max(0, Math.min(1 - 1e-15, mercator.x));
            const my = Math.max(0, Math.min(1 - 1e-15, mercator.y));

            for (let z = this.maxzoom; z >= this.minzoom; z--) {
                const tileCount = 1 << z;
                const tileX = Math.min(Math.floor(mx * tileCount), tileCount - 1);
                const tileY = Math.min(Math.floor(my * tileCount), tileCount - 1);

                // For raster-dem sources, overscaledZ always equals canonical z
                const key = calculateTileKey(0, z, z, tileX, tileY);
                const tile = tileManager.getAnyTileByID(key);
                if (!tile?.dem) continue;

                const fx = mx * tileCount - tileX;
                const fy = my * tileCount - tileY;

                return {
                    elevation: sampleDEMBilinear(tile.dem, fx, fy),
                    tileZoom: z
                };
            }

            return null;
        });
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

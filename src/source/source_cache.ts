import {create as createSource} from './source';

import {Tile, FadingDirections, FadingRoles} from './tile';
import {ErrorEvent, Event, Evented} from '../util/evented';
import {TileCache} from './tile_cache';
import {MercatorCoordinate} from '../geo/mercator_coordinate';
import {EXTENT} from '../data/extent';
import {type Context} from '../gl/context';
import Point from '@mapbox/point-geometry';
import {browser} from '../util/browser';
import {OverscaledTileID} from './tile_id';
import {SourceFeatureState} from './source_state';
import {getEdgeTiles} from '../util/util';
import {config} from '../util/config';

import type {Source} from './source';
import type {Map} from '../ui/map';
import type {Style} from '../style/style';
import type {Dispatcher} from '../util/dispatcher';
import type {IReadonlyTransform, ITransform} from '../geo/transform_interface';
import type {TileState} from './tile';
import type {ICanonicalTileID, SourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {MapSourceDataEvent} from '../ui/events';
import type {Terrain} from '../render/terrain';
import type {CanvasSourceSpecification} from './canvas_source';
import {coveringTiles, coveringZoomLevel} from '../geo/projection/covering_tiles';
import {Bounds} from '../geo/bounds';
import {EXTENT_BOUNDS} from '../data/extent_bounds';

type TileResult = {
    tile: Tile;
    tileID: OverscaledTileID;
    queryGeometry: Array<Point>;
    cameraQueryGeometry: Array<Point>;
    scale: number;
};

/**
 * @internal
 * `SourceCache` is responsible for
 *
 *  - creating an instance of `Source`
 *  - forwarding events from `Source`
 *  - caching tiles loaded from an instance of `Source`
 *  - loading the tiles needed to render a given viewport
 *  - unloading the cached tiles not needed to render a given viewport
 */
export class SourceCache extends Evented {
    id: string;
    dispatcher: Dispatcher;
    map: Map;
    style: Style;

    _source: Source;

    /**
     * @internal
     * signifies that the TileJSON is loaded if applicable.
     * if the source type does not come with a TileJSON, the flag signifies the
     * source data has loaded (i.e geojson has been tiled on the worker and is ready)
     */
    _sourceLoaded: boolean;

    _sourceErrored: boolean;
    _tiles: Record<string, Tile>;
    _prevLng: number;
    _cache: TileCache;
    _timers: {
        [_ in any]: ReturnType<typeof setTimeout>;
    };
    _cacheTimers: {
        [_ in any]: ReturnType<typeof setTimeout>;
    };
    _maxTileCacheSize: number;
    _maxTileCacheZoomLevels: number;
    _paused: boolean;
    _shouldReloadOnResume: boolean;
    transform: ITransform;
    terrain: Terrain;
    used: boolean;
    usedForTerrain: boolean;
    tileSize: number;
    _state: SourceFeatureState;
    _didEmitContent: boolean;
    _updated: boolean;
    _rasterFadeDuration: number;
    _maxFadingAncestorLevels: number;

    static maxUnderzooming: number;
    static maxOverzooming: number;

    constructor(id: string, options: SourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;

        this.on('data', (e: MapSourceDataEvent) => this._dataHandler(e));

        this.on('dataloading', () => {
            this._sourceErrored = false;
        });

        this.on('error', () => {
            // Only set _sourceErrored if the source does not have pending loads.
            this._sourceErrored = this._source.loaded();
        });

        this._source = createSource(id, options, dispatcher, this);

        this._tiles = {};
        this._cache = new TileCache(0, (tile) => this._unloadTile(tile));
        this._timers = {};
        this._cacheTimers = {};
        this._maxTileCacheSize = null;
        this._maxTileCacheZoomLevels = null;
        this._rasterFadeDuration = 0;
        this._maxFadingAncestorLevels = 5;

        this._state = new SourceFeatureState();
        this._didEmitContent = false;
        this._updated = false;
    }

    onAdd(map: Map) {
        this.map = map;
        this._maxTileCacheSize = map ? map._maxTileCacheSize : null;
        this._maxTileCacheZoomLevels = map ? map._maxTileCacheZoomLevels : null;
        if (this._source && this._source.onAdd) {
            this._source.onAdd(map);
        }
    }

    onRemove(map: Map) {
        this.clearTiles();
        if (this._source && this._source.onRemove) {
            this._source.onRemove(map);
        }
    }

    /**
     * Return true if no tile data is pending, tiles will not change unless
     * an additional API call is received.
     */
    loaded(): boolean {
        if (this._sourceErrored) { return true; }
        if (!this._sourceLoaded) { return false; }
        if (!this._source.loaded()) { return false; }
        if ((this.used !== undefined || this.usedForTerrain !== undefined) && !this.used && !this.usedForTerrain) { return true; }
        // do not consider as loaded if the update hasn't been called yet (we do not know if we will have any tiles to fetch)
        if (!this._updated) { return false; }

        for (const t in this._tiles) {
            const tile = this._tiles[t];
            if (tile.state !== 'loaded' && tile.state !== 'errored')
                return false;
        }
        return true;
    }

    getSource(): Source {
        return this._source;
    }

    pause() {
        this._paused = true;
    }

    resume() {
        if (!this._paused) return;
        const shouldReload = this._shouldReloadOnResume;
        this._paused = false;
        this._shouldReloadOnResume = false;
        if (shouldReload) this.reload();
        if (this.transform) this.update(this.transform, this.terrain);
    }

    async _loadTile(tile: Tile, id: string, state: TileState): Promise<void> {
        try {
            await this._source.loadTile(tile);
            this._tileLoaded(tile, id, state);
        } catch (err) {
            tile.state = 'errored';
            if ((err as any).status !== 404) {
                this._source.fire(new ErrorEvent(err, {tile}));
            } else {
                // continue to try loading parent/children tiles if a tile doesn't exist (404)
                this.update(this.transform, this.terrain);
            }
        }
    }

    _unloadTile(tile: Tile) {
        if (this._source.unloadTile)
            this._source.unloadTile(tile);
    }

    _abortTile(tile: Tile) {
        if (this._source.abortTile)
            this._source.abortTile(tile);

        this._source.fire(new Event('dataabort', {tile, coord: tile.tileID, dataType: 'source'}));
    }

    serialize() {
        return this._source.serialize();
    }

    prepare(context: Context) {
        if  (this._source.prepare) {
            this._source.prepare();
        }

        this._state.coalesceChanges(this._tiles, this.map ? this.map.painter : null);
        for (const i in this._tiles) {
            const tile = this._tiles[i];
            tile.upload(context);
            tile.prepare(this.map.style.imageManager);
        }
    }

    /**
     * Return all tile ids ordered with z-order, and cast to numbers
     */
    getIds(): Array<string> {
        return Object.values(this._tiles).map(tile => tile.tileID).sort(compareTileId).map(id => id.key);
    }

    getRenderableIds(symbolLayer?: boolean): Array<string> {
        const renderables: Array<Tile> = [];
        for (const id in this._tiles) {
            if (this._isIdRenderable(id, symbolLayer)) renderables.push(this._tiles[id]);
        }
        if (symbolLayer) {
            return renderables.sort((a_: Tile, b_: Tile) => {
                const a = a_.tileID;
                const b = b_.tileID;
                const rotatedA = (new Point(a.canonical.x, a.canonical.y))._rotate(-this.transform.bearingInRadians);
                const rotatedB = (new Point(b.canonical.x, b.canonical.y))._rotate(-this.transform.bearingInRadians);
                return a.overscaledZ - b.overscaledZ || rotatedB.y - rotatedA.y || rotatedB.x - rotatedA.x;
            }).map(tile => tile.tileID.key);
        }
        return renderables.map(tile => tile.tileID).sort(compareTileId).map(id => id.key);
    }

    hasRenderableParent(tileID: OverscaledTileID) {
        const parentZ = tileID.overscaledZ - 1;
        if (parentZ >= this._source.minzoom) {
            const parentTile = this._getLoadedTile(tileID.scaledTo(parentZ));
            if (parentTile) {
                return this._isIdRenderable(parentTile.tileID.key);
            }
        }
        return false;
    }

    _isIdRenderable(id: string, symbolLayer: boolean = false) {
        return this._tiles[id]?.isRenderable(symbolLayer);
    }

    /**
     * Reload tiles in this source. If source data has changed, reload all tiles using a state of 'expired',
     * otherwise reload only non-errored tiles using state of 'reloading'.
     */
    reload(sourceDataChanged?: boolean) {
        if (this._paused) {
            this._shouldReloadOnResume = true;
            return;
        }

        this._cache.reset();

        for (const i in this._tiles) {
            if (sourceDataChanged) {
                this._reloadTile(i, 'expired');
            } else if (this._tiles[i].state !== 'errored') {
                this._reloadTile(i, 'reloading');
            }
        }
    }

    async _reloadTile(id: string, state: TileState) {
        const tile = this._tiles[id];

        // this potentially does not address all underlying
        // issues https://github.com/mapbox/mapbox-gl-js/issues/4252
        // - hard to tell without repro steps
        if (!tile) return;

        // The difference between "loading" tiles and "reloading" or "expired"
        // tiles is that "reloading"/"expired" tiles are "renderable".
        // Therefore, a "loading" tile cannot become a "reloading" tile without
        // first becoming a "loaded" tile.
        if (tile.state !== 'loading') {
            tile.state = state;
        }
        await this._loadTile(tile, id, state);
    }

    _tileLoaded(tile: Tile, id: string, previousState: TileState) {
        tile.timeAdded = browser.now();
        if (previousState === 'expired') tile.refreshedUponExpiration = true;
        this._setTileReloadTimer(id, tile);
        if (this.getSource().type === 'raster-dem' && tile.dem) this._backfillDEM(tile);
        this._state.initializeTileState(tile, this.map ? this.map.painter : null);

        if (!tile.aborted) {
            this._source.fire(new Event('data', {dataType: 'source', tile, coord: tile.tileID}));
        }
    }

    /**
     * For raster terrain source, backfill DEM to eliminate visible tile boundaries
     */
    _backfillDEM(tile: Tile) {
        const renderables = this.getRenderableIds();
        for (let i = 0; i < renderables.length; i++) {
            const borderId = renderables[i];
            if (tile.neighboringTiles && tile.neighboringTiles[borderId]) {
                const borderTile = this.getTileByID(borderId);
                fillBorder(tile, borderTile);
                fillBorder(borderTile, tile);
            }
        }

        function fillBorder(tile, borderTile) {
            tile.needsHillshadePrepare = true;
            tile.needsTerrainPrepare = true;
            let dx = borderTile.tileID.canonical.x - tile.tileID.canonical.x;
            const dy = borderTile.tileID.canonical.y - tile.tileID.canonical.y;
            const dim = Math.pow(2, tile.tileID.canonical.z);
            const borderId = borderTile.tileID.key;
            if (dx === 0 && dy === 0) return;

            if (Math.abs(dy) > 1) {
                return;
            }
            if (Math.abs(dx) > 1) {
                // Adjust the delta coordinate for world wraparound.
                if (Math.abs(dx + dim) === 1) {
                    dx += dim;
                } else if (Math.abs(dx - dim) === 1) {
                    dx -= dim;
                }
            }
            if (!borderTile.dem || !tile.dem) return;
            tile.dem.backfillBorder(borderTile.dem, dx, dy);
            if (tile.neighboringTiles && tile.neighboringTiles[borderId])
                tile.neighboringTiles[borderId].backfilled = true;
        }
    }
    /**
     * Get a specific tile by TileID
     */
    getTile(tileID: OverscaledTileID): Tile {
        return this.getTileByID(tileID.key);
    }

    /**
     * Get a specific tile by id
     */
    getTileByID(id: string): Tile {
        return this._tiles[id];
    }

    /**
     * Retain the uppermost loaded children of each provided target tile, within a variable covering zoom range.
     *
     * On pitched maps, different parts of the screen show different zoom levels simultaneously.
     * Ideal tiles are generated using coveringTiles() above, which returns the ideal tile set for
     * the current pitched plane, which can carry tiles of varying zooms (overscaledZ).
     * See: https://maplibre.org/maplibre-gl-js/docs/examples/level-of-detail-control/
     *
     * A fixed `maxCoveringZoom` on a pitched map would incorrectly intersect with some
     * ideal tiles and cause distant high-pitch tiles to skip their uppermost children.
     *
     * To solve this, we calculate the max covering zoom for each ideal tile separately using its
     * `overscaledZ`. This effectively makes the "max covering zoom plane" parallel to the
     * "ideal tile plane," ensuring that we correctly capture the uppermost children
     * of each ideal tile across the pitched view.
     *
     * Analogy: imagine two sheets of paper in 3D space:
     *   - one sheet = ideal tiles at varying overscaledZ
     *   - the second sheet = maxCoveringZoom
     */

    _retainLoadedChildren(
        targetTiles: Record<string, OverscaledTileID>,
        retain: Record<string, OverscaledTileID>
    ) {
        const targetTileIDs = Object.values(targetTiles);
        const loadedDescendents: Record<string, Tile[]> = this._getLoadedDescendents(targetTileIDs);
        const incomplete: Record<string, OverscaledTileID> = {};

        // retain the uppermost descendents of target tiles
        for (const targetID of targetTileIDs) {
            const descendents = loadedDescendents[targetID.key];
            if (!descendents?.length) {
                incomplete[targetID.key] = targetID;
                continue;
            }

            // find descendents within the max covering zoom range
            const maxCoveringZoom = targetID.overscaledZ + SourceCache.maxUnderzooming;
            const candidates = descendents.filter(t => t.tileID.overscaledZ <= maxCoveringZoom);
            if (!candidates.length) {
                incomplete[targetID.key] = targetID;
                continue;
            }

            // retain the uppermost descendents in the topmost zoom below the target tile
            const topZoom = Math.min(...candidates.map(t => t.tileID.overscaledZ));
            const topIDs = candidates.filter(t => t.tileID.overscaledZ === topZoom).map(t => t.tileID);
            for (const tileID of topIDs) {
                retain[tileID.key] = tileID;
            }

            //determine if the retained generation is fully covered
            if (!this._areDescendentsComplete(topIDs, topZoom, targetID.overscaledZ)) {
                incomplete[targetID.key] = targetID;
            }
        }

        return incomplete;
    }

    /**
     * Return dictionary of qualified loaded descendents for each provided target tile id
     */
    _getLoadedDescendents(targetTileIDs: OverscaledTileID[]) {
        const loadedDescendents: Record<string, Tile[]> = {};

        // enumerate tiles currently in this source and find the loaded descendents of each target tile
        for (const sourceKey in this._tiles) {
            const sourceTile = this._tiles[sourceKey];
            if (!sourceTile.hasData()) continue;

            // determine if the loaded source tile (hasData) is a qualified descendent of any target tile
            for (const targetID of targetTileIDs) {
                if (sourceTile.tileID.isChildOf(targetID)) {
                    (loadedDescendents[targetID.key] ||= []).push(sourceTile);
                }
            }
        }

        return loadedDescendents;
    }

    /**
     * Determine if tile ids fully cover the current generation.
     * - 1st generation: need 4 children or 1 overscaled child
     * - 2nd generation: need 16 children or 1 overscaled child
     */
    _areDescendentsComplete(generationIDs: OverscaledTileID[], generationZ: number, ancestorZ: number) {
        //if overscaled, seeking 1 tile at generationZ, otherwise seeking a power of 4 for each descending Z
        if (generationIDs.length === 1 && generationIDs[0].isOverscaled()) {
            return generationIDs[0].overscaledZ === generationZ;
        } else {
            const expectedTiles = Math.pow(4, generationZ - ancestorZ);  //4, 16, 64 (for first 3 gens)
            return expectedTiles === generationIDs.length;
        }
    }

    /**
     * Get a loaded tile currently in this source.
     * - loaded tiles exist in this._tiles - a cached tile is not a loaded tile
     */
    _getLoadedTile(tileID: OverscaledTileID): Tile | null {
        const tile = this._tiles[tileID.key];
        if (tile?.hasData()) {
            return tile;
        }
        return null;
    }

    /**
     * Resizes the tile cache based on the current viewport's size
     * or the maxTileCacheSize option passed during map creation
     *
     * Larger viewports use more tiles and need larger caches. Larger viewports
     * are more likely to be found on devices with more memory and on pages where
     * the map is more important.
     */
    updateCacheSize(transform: IReadonlyTransform) {
        const widthInTiles = Math.ceil(transform.width / this._source.tileSize) + 1;
        const heightInTiles = Math.ceil(transform.height / this._source.tileSize) + 1;
        const approxTilesInView = widthInTiles * heightInTiles;
        const commonZoomRange = this._maxTileCacheZoomLevels === null ?
            config.MAX_TILE_CACHE_ZOOM_LEVELS : this._maxTileCacheZoomLevels;
        const viewDependentMaxSize = Math.floor(approxTilesInView * commonZoomRange);
        const maxSize = typeof this._maxTileCacheSize === 'number' ?
            Math.min(this._maxTileCacheSize, viewDependentMaxSize) : viewDependentMaxSize;

        this._cache.setMaxSize(maxSize);
    }

    handleWrapJump(lng: number) {
        // On top of the regular z/x/y values, TileIDs have a `wrap` value that specify
        // which copy of the world the tile belongs to. For example, at `lng: 10` you
        // might render z/x/y/0 while at `lng: 370` you would render z/x/y/1.
        //
        // When lng values get wrapped (going from `lng: 370` to `long: 10`) you expect
        // to see the same thing on the screen (370 degrees and 10 degrees is the same
        // place in the world) but all the TileIDs will have different wrap values.
        //
        // In order to make this transition seamless, we calculate the rounded difference of
        // "worlds" between the last frame and the current frame. If the map panned by
        // a world, then we can assign all the tiles new TileIDs with updated wrap values.
        // For example, assign z/x/y/1 a new id: z/x/y/0. It is the same tile, just rendered
        // in a different position.
        //
        // This enables us to reuse the tiles at more ideal locations and prevent flickering.
        const prevLng = this._prevLng === undefined ? lng : this._prevLng;
        const lngDifference = lng - prevLng;
        const worldDifference = lngDifference / 360;
        const wrapDelta = Math.round(worldDifference);
        this._prevLng = lng;

        if (wrapDelta) {
            const tiles: Record<string, Tile> = {};
            for (const key in this._tiles) {
                const tile = this._tiles[key];
                tile.tileID = tile.tileID.unwrapTo(tile.tileID.wrap + wrapDelta);
                tiles[tile.tileID.key] = tile;
            }
            this._tiles = tiles;

            // Reset tile reload timers
            for (const id in this._timers) {
                clearTimeout(this._timers[id]);
                delete this._timers[id];
            }
            for (const id in this._tiles) {
                const tile = this._tiles[id];
                this._setTileReloadTimer(id, tile);
            }
        }
    }

    /**
     * Removes tiles that are outside the viewport and adds new tiles that
     * are inside the viewport.
     */
    update(transform: ITransform, terrain?: Terrain) {
        if (!this._sourceLoaded || this._paused) {
            return;
        }
        this.transform = transform;
        this.terrain = terrain;

        this.updateCacheSize(transform);
        this.handleWrapJump(this.transform.center.lng);

        let idealTileIDs: OverscaledTileID[];

        if (!this.used && !this.usedForTerrain) {
            idealTileIDs = [];
        } else if (this._source.tileID) {
            idealTileIDs = transform.getVisibleUnwrappedCoordinates(this._source.tileID)
                .map((unwrapped) => new OverscaledTileID(unwrapped.canonical.z, unwrapped.wrap, unwrapped.canonical.z, unwrapped.canonical.x, unwrapped.canonical.y));
        } else {
            idealTileIDs = coveringTiles(transform, {
                tileSize: this.usedForTerrain ? this.tileSize : this._source.tileSize,
                minzoom: this._source.minzoom,
                maxzoom: this._source.maxzoom,
                roundZoom: this.usedForTerrain ? false : this._source.roundZoom,
                reparseOverscaled: this._source.reparseOverscaled,
                terrain,
                calculateTileZoom: this._source.calculateTileZoom
            });

            if (this._source.hasTile) {
                idealTileIDs = idealTileIDs.filter((coord) => this._source.hasTile(coord));
            }
        }

        // When sourcecache is used for terrain also load parent tiles for complete rendering of 3d terrain levels
        if (this.usedForTerrain) {
            idealTileIDs = this._addTerrainIdealTiles(idealTileIDs);
        }

        const noPendingDataEmissions = idealTileIDs.length === 0 && !this._updated && this._didEmitContent;
        this._updated = true;
        // if we won't have any tiles to fetch and content is already emitted
        // there will be no more data emissions, so we need to emit the event with isSourceLoaded = true
        if (noPendingDataEmissions) {
            this.fire(new Event('data', {sourceDataType: 'idle', dataType: 'source', sourceId: this.id}));
        }

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        const zoom: number = coveringZoomLevel(transform, this._source);
        const retain: Record<string, OverscaledTileID> = this._updateRetainedTiles(idealTileIDs, zoom);

        // enable fading for raster source except when using terrain which doesn't currently support fading
        const isRaster = isRasterType(this._source.type);
        if (isRaster && this._rasterFadeDuration > 0 && !terrain) {
            this._updateFadingTiles(idealTileIDs, retain);
        }

        // clean up non-retained tiles in this source
        if (isRaster) {
            this._cleanUpRasterTiles(retain);
        } else {
            this._cleanUpVectorTiles(retain);
        }
    }

    /**
     * Remove raster tiles that are no longer retained
     */
    _cleanUpRasterTiles(retain: Record<string, OverscaledTileID>) {
        for (const key in this._tiles) {
            if (!retain[key]) {
                this._removeTile(key);
            }
        }
    }

    /**
     * Remove vector tiles that are no longer retained and also not needed for symbol fading
     */
    _cleanUpVectorTiles(retain: Record<string, OverscaledTileID>) {
        for (const key in this._tiles) {
            const tile = this._tiles[key];

            // retained - clear fade hold so if it's removed again fade timer starts fresh.
            if (retain[key]) {
                tile.clearSymbolFadeHold();
                continue;
            }

            // remove non-retained tiles without symbols
            if (!tile.hasSymbolBuckets) {
                this._removeTile(key);
                continue;
            }

            // for tile with symbols - hold for fade - then remove
            if (!tile.holdingForSymbolFade()) {
                tile.setSymbolHoldDuration(this.map._fadeDuration);
            } else if (tile.symbolFadeFinished()) {
                this._removeTile(key);
            }
        }
    }

    /**
     * Add ideal tiles needed for 3D terrain rendering
     */
    _addTerrainIdealTiles(idealTileIDs: OverscaledTileID[]): OverscaledTileID[] {
        const ancestors = [];

        for (const tileID of idealTileIDs) {
            if (tileID.canonical.z > this._source.minzoom) {
                const parent = tileID.scaledTo(tileID.canonical.z - 1);
                ancestors.push(parent);
                // load very low zoom to calculate tile visibility in transform.coveringTiles and high zoom levels correct
                const parent2 = tileID.scaledTo(Math.max(this._source.minzoom, Math.min(tileID.canonical.z, 5)));
                ancestors.push(parent2);
            }
        }

        return idealTileIDs.concat(ancestors);
    }

    releaseSymbolFadeTiles() {
        for (const id in this._tiles) {
            if (this._tiles[id].holdingForSymbolFade()) {
                this._removeTile(id);
            }
        }
    }

    /**
     * Set tiles to be retained on update of this source. For ideal tiles that do not have data, retain their loaded
     * children so they can be displayed as substitutes pending load of each ideal tile (to reduce flickering).
     * If no loaded children are available, fallback to seeking loaded parents as an alternative substitute.
     */
    _updateRetainedTiles(idealTileIDs: Array<OverscaledTileID>, zoom: number): Record<string, OverscaledTileID> {
        const retain: Record<string, OverscaledTileID> = {};
        const checked: Record<string, boolean> = {};
        const minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this._source.minzoom);

        let missingIdealTiles = {};
        for (const idealID of idealTileIDs) {
            const idealTile = this._addTile(idealID);

            // retain the tile even if it's not loaded because it's an ideal tile.
            retain[idealID.key] = idealID;

            if (!idealTile.hasData()) {
                missingIdealTiles[idealID.key] = idealID;
            }
        }

        missingIdealTiles = this._retainLoadedChildren(missingIdealTiles, retain);

        // for remaining missing tiles with incomplete child coverage, seek a loaded parent tile
        for (const idealKey in missingIdealTiles) {
            const tileID = missingIdealTiles[idealKey];
            let tile = this._tiles[idealKey];

            // As we ascend up the tile pyramid of the ideal tile, we check whether the parent
            // tile has been previously requested (and errored because we only loop over tiles with no data)
            // in order to determine if we need to request its parent.
            let parentWasRequested = tile?.wasRequested();

            for (let overscaledZ = tileID.overscaledZ - 1; overscaledZ >= minCoveringZoom; --overscaledZ) {
                const parentId = tileID.scaledTo(overscaledZ);

                // Break parent tile ascent if this route has been previously checked by another child.
                if (checked[parentId.key]) break;
                checked[parentId.key] = true;

                tile = this.getTile(parentId);
                if (!tile && parentWasRequested) {
                    tile = this._addTile(parentId);
                }
                if (tile) {
                    const hasData = tile.hasData();
                    if (hasData || !this.map?.cancelPendingTileRequestsWhileZooming || parentWasRequested) {
                        retain[parentId.key] = parentId;
                    }
                    // Save the current values, since they're the parent of the next iteration
                    // of the parent tile ascent loop.
                    parentWasRequested = tile.wasRequested();
                    if (hasData) break;
                }
            }
        }

        return retain;
    }

    /**
     * Designate fading bases and parents using a many-to-one relationship where the lower children fade in/out
     * with their parents. Raster shaders are not currently designed for a one-to-many fade relationship.
     *
     * Tiles that are candidates for fading out must be loaded and rendered tiles, as loading a tile to then
     * fade it out would not appear smoothly. The first source of truth for tile fading always starts at the
     * ideal tile, which continually changes on map adjustment. The state of the previously rendered ideal
     * tile plane indicates which direction to fade each part of the newer ideal plane (with varying z).
     *
     * For a pitched map, the back of the map can have decreasing zooms while the front can have increasing zooms.
     * Fade logic must therefore adapt dynamically based on the previously rendered ideal tile set.
     */
    _updateFadingTiles(idealTileIDs: OverscaledTileID[], retain: Record<string, OverscaledTileID>) {
        const now: number = browser.now();
        const edgeTileIDs: Set<OverscaledTileID> = getEdgeTiles(idealTileIDs);

        for (const idealID of idealTileIDs) {
            const idealTile = this._tiles[idealID.key];

            // reset any previously departing(ed) tiles that are now ideal tiles
            if (idealTile.fadingDirection === FadingDirections.Departing || idealTile.fadeOpacity === 0) {
                idealTile.resetFadeLogic();
            }

            const parentIsFader = this._updateFadingAncestor(idealTile, retain, now);
            if (parentIsFader) continue;

            const childIsFader = this._updateFadingDescendents(idealTile, retain, now);
            if (childIsFader) continue;

            const edgeIsFader = this._updateFadingEdge(idealTile, edgeTileIDs, now);
            if (edgeIsFader) continue;

            // for all remaining non-fading ideal tiles reset the fade logic
            idealTile.resetFadeLogic();
        }
    }

    /**
     * Many-to-one cross-fade. Set 4 ideal tiles as the fading base for a rendered parent tile
     * as the fading parent. Here the parent is fading out and the ideal tile is fading in.
     *
     * Parent tile - fading out                                ■                                -- Fading Parent
     *                                   ┌──────────────┬──────┴───────┬──────────────┐
     * Ideal tiles - fading in           ■              ■              ■              ■         -- Base Role = Incoming
     *                             ┌───┬─┴─┬───┐  ┌───┬─┴─┬───┐  ┌───┬─┴─┬───┐  ┌───┬─┴─┬───┐
     *                             ■   ■   ■   ■  ■   ■   ■   ■  ■   ■   ■   ■  ■   ■   ■   ■
     */
    _updateFadingAncestor(idealTile: Tile, retain: Record<string, OverscaledTileID>, now: number): boolean {
        if (!idealTile.hasData()) return false;

        const {tileID: idealID, fadingRole, fadingDirection, fadingParentID} = idealTile;
        // ideal tile already has fading parent - retain and return
        if (fadingRole === FadingRoles.Base && fadingDirection === FadingDirections.Incoming && fadingParentID) {
            retain[fadingParentID.key] = fadingParentID;
            return true;
        }

        // find a loaded parent tile to fade with the ideal tile
        const minAncestorZ = Math.max(idealID.overscaledZ - this._maxFadingAncestorLevels, this._source.minzoom);
        for (let ancestorZ = idealID.overscaledZ - 1; ancestorZ >= minAncestorZ; ancestorZ--) {
            const ancestorID = idealID.scaledTo(ancestorZ);
            const ancestorTile = this._getLoadedTile(ancestorID);
            if (!ancestorTile) continue;

            // ideal tile (base) is fading in
            idealTile.setCrossFadeLogic({
                fadingRole: FadingRoles.Base,
                fadingDirection: FadingDirections.Incoming,
                fadingParentID: ancestorTile.tileID,  // fading out
                fadeEndTime: now + this._rasterFadeDuration
            });
            // ancestor tile (parent) is fading out
            ancestorTile.setCrossFadeLogic({
                fadingRole: FadingRoles.Parent,
                fadingDirection: FadingDirections.Departing,
                fadeEndTime: now + this._rasterFadeDuration
            });

            retain[ancestorID.key] = ancestorID;
            return true;
        }
        return false;
    }

    /**
     * Many-to-one cross-fade. Search descendents of ideal tiles as the fading base with the ideal tile
     * as the fading parent. Here the children are fading out and the ideal tile is fading in.
     *
     *                                                         ■
     *                                   ┌──────────────┬──────┴───────┬──────────────┐
     * Ideal tiles - fading in           ■              ■              ■              ■          -- Fading Parent
     *                             ┌───┬─┴─┬───┐  ┌───┬─┴─┬───┐  ┌───┬─┴─┬───┐  ┌───┬─┴─┬───┐
     * Child tiles - fading out    ■   ■   ■   ■  ■   ■   ■   ■  ■   ■   ■   ■  ■   ■   ■   ■    -- Base Role = Departing
     *
     * Try direct children first. If none found, try grandchildren. Stops at the first generation that provides a fader.
     */
    _updateFadingDescendents(idealTile: Tile, retain: Record<string, OverscaledTileID>, now: number): boolean {
        if (!idealTile.hasData()) return false;

        // search first level of descendents (4 tiles)
        const idealChildren = idealTile.tileID.children(this._source.maxzoom);
        let hasFader = this._updateFadingChildren(idealTile, idealChildren, retain, now);
        if (hasFader) return true;

        // search second level of descendents (16 tiles)
        for (const childID of idealChildren) {
            const grandChildIDs = childID.children(this._source.maxzoom);
            if (this._updateFadingChildren(idealTile, grandChildIDs, retain, now)) {
                hasFader = true;
            }
        }

        return hasFader;
    }

    _updateFadingChildren(idealTile: Tile, childIDs: OverscaledTileID[], retain: Record<string, OverscaledTileID>, now: number): boolean {
        if (childIDs[0].overscaledZ >= this._source.maxzoom) return false;
        let foundFader = false;

        // find loaded child tiles to fade with the ideal tile
        for (const childID of childIDs) {
            const childTile = this._getLoadedTile(childID);
            if (!childTile) continue;

            const {fadingRole, fadingDirection, fadingParentID} = childTile;
            if (fadingRole !== FadingRoles.Base || fadingDirection !== FadingDirections.Departing || !fadingParentID) {
                // child tile (base) is fading out
                childTile.setCrossFadeLogic({
                    fadingRole: FadingRoles.Base,
                    fadingDirection: FadingDirections.Departing,
                    fadingParentID: idealTile.tileID,
                    fadeEndTime: now + this._rasterFadeDuration
                });
                // ideal tile (parent) is fading in
                idealTile.setCrossFadeLogic({
                    fadingRole: FadingRoles.Parent,
                    fadingDirection: FadingDirections.Incoming,
                    fadeEndTime: now + this._rasterFadeDuration
                });
            }

            retain[childID.key] = childID;
            foundFader = true;
        }

        return foundFader;
    }

    /**
     * One-to-one self fading for unloaded edge tiles (for panning sideways on map). for loading tiles over gaps it feels
     * more natural for them to fade in, however if they are already loaded/cached then there is no need to fade as map will
     * look cohesive with no gaps. Note that draw_raster determines fade priority, as many-to-one fade supersedes edge fading.
     */
    _updateFadingEdge(idealTile: Tile, edgeTileIDs: Set<OverscaledTileID>, now: number): boolean {
        const idealID: OverscaledTileID = idealTile.tileID;

        // tile is already self fading
        if (idealTile.selfFading) {
            return true;
        }

        // fading not needed for tiles that are already loaded
        if (idealTile.hasData()) {
            return false;
        }

        // enable fading for loading edges with no data
        if (edgeTileIDs.has(idealID)) {
            const fadeEndTime = now + this._rasterFadeDuration;
            idealTile.setSelfFadeLogic(fadeEndTime);
            return true;
        }

        return false;
    }

    /**
     * Add a tile, given its coordinate, to the pyramid.
     */
    _addTile(tileID: OverscaledTileID): Tile {
        let tile = this._tiles[tileID.key];
        if (tile)
            return tile;

        tile = this._cache.getAndRemove(tileID);
        if (tile) {
            //reset fading logic to remove stale fading data from cache
            tile.resetFadeLogic();

            // set timer for the reloading of the tile upon expiration
            this._setTileReloadTimer(tileID.key, tile);

            // set the tileID because the cached tile could have had a different wrap value
            tile.tileID = tileID;
            this._state.initializeTileState(tile, this.map ? this.map.painter : null);
            if (this._cacheTimers[tileID.key]) {
                clearTimeout(this._cacheTimers[tileID.key]);
                delete this._cacheTimers[tileID.key];
                this._setTileReloadTimer(tileID.key, tile);
            }
        }

        const cached = tile;

        if (!tile) {
            tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor());
            this._loadTile(tile, tileID.key, tile.state);
        }

        tile.uses++;
        this._tiles[tileID.key] = tile;
        if (!cached) {
            this._source.fire(new Event('dataloading', {tile, coord: tile.tileID, dataType: 'source'}));
        }

        return tile;
    }

    _setTileReloadTimer(id: string, tile: Tile) {
        if (id in this._timers) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }

        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._timers[id] = setTimeout(() => {
                this._reloadTile(id, 'expired');
                delete this._timers[id];
            }, expiryTimeout);
        }
    }

    /**
     * Reload any currently renderable tiles that are match one of the incoming `tileId` x/y/z
     */
    refreshTiles(tileIds: Array<ICanonicalTileID>) {
        for (const id in this._tiles) {
            if (!this._isIdRenderable(id) && this._tiles[id].state != 'errored') {
                continue;
            }
            if (tileIds.some(tid => tid.equals(this._tiles[id].tileID.canonical))) {
                this._reloadTile(id, 'expired');
            }
        }
    }

    /**
     * Remove a tile, given its id, from the pyramid
     */
    _removeTile(id: string) {
        const tile = this._tiles[id];
        if (!tile)
            return;

        tile.uses--;
        delete this._tiles[id];
        if (this._timers[id]) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }

        if (tile.uses > 0)
            return;

        if (tile.hasData() && tile.state !== 'reloading') {
            this._cache.add(tile.tileID, tile, tile.getExpiryTimeout());
        } else {
            tile.aborted = true;
            this._abortTile(tile);
            this._unloadTile(tile);
        }
    }

    /** @internal
     * Handles incoming source data messages (i.e. after the source has been updated via a worker that has fired
     * to map.ts data event). For sources with mutable data, the 'content' event fires when the underlying data
     * to a source has changed. (i.e. GeoJSONSource.setData and ImageSource.setCoordinates)
     */
    private _dataHandler(e: MapSourceDataEvent) {
        if (e.dataType !== 'source') return;

        if (e.sourceDataType === 'metadata') {
            this._sourceLoaded = true;
            return;
        }

        if (e.sourceDataType !== 'content' || !this._sourceLoaded || this._paused) {
            return;
        }

        this.reload(e.sourceDataChanged);
        if (this.transform) {
            this.update(this.transform, this.terrain);
        }
        this._didEmitContent = true;
    }

    /**
     * Remove all tiles from this pyramid
     */
    clearTiles() {
        this._shouldReloadOnResume = false;
        this._paused = false;

        for (const id in this._tiles)
            this._removeTile(id);

        this._cache.reset();
    }

    /**
     * Search through our current tiles and attempt to find the tiles that
     * cover the given bounds.
     * @param pointQueryGeometry - coordinates of the corners of bounding rectangle
     * @returns result items have `{tile, minX, maxX, minY, maxY}`, where min/max bounding values are the given bounds transformed in into the coordinate space of this tile.
     */
    tilesIn(pointQueryGeometry: Array<Point>, maxPitchScaleFactor: number, has3DLayer: boolean): TileResult[] {
        const tileResults: TileResult[] = [];

        const transform = this.transform;
        if (!transform) return tileResults;
        const allowWorldCopies = transform.getCoveringTilesDetailsProvider().allowWorldCopies();

        const cameraPointQueryGeometry = has3DLayer ?
            transform.getCameraQueryGeometry(pointQueryGeometry) :
            pointQueryGeometry;

        const project = (point: Point) => transform.screenPointToMercatorCoordinate(point, this.terrain);
        const queryGeometry = this.transformBbox(pointQueryGeometry, project, !allowWorldCopies);
        const cameraQueryGeometry = this.transformBbox(cameraPointQueryGeometry, project, !allowWorldCopies);

        const ids = this.getIds();

        const cameraBounds = Bounds.fromPoints(cameraQueryGeometry);

        for (let i = 0; i < ids.length; i++) {
            const tile = this._tiles[ids[i]];
            if (tile.holdingForSymbolFade()) {
                // Tiles held for fading are covered by tiles that are closer to ideal
                continue;
            }
            // if the projection does not render world copies then we need to explicitly check for the bounding box crossing the antimeridian
            const tileIDs = allowWorldCopies ? [tile.tileID] : [tile.tileID.unwrapTo(-1), tile.tileID.unwrapTo(0)];
            const scale = Math.pow(2, transform.zoom - tile.tileID.overscaledZ);
            const queryPadding = maxPitchScaleFactor * tile.queryPadding * EXTENT / tile.tileSize / scale;

            for (const tileID of tileIDs) {

                const tileSpaceBounds = cameraBounds.map(point => tileID.getTilePoint(new MercatorCoordinate(point.x, point.y)));
                tileSpaceBounds.expandBy(queryPadding);

                if (tileSpaceBounds.intersects(EXTENT_BOUNDS)) {

                    const tileSpaceQueryGeometry: Array<Point> = queryGeometry.map((c) => tileID.getTilePoint(c));
                    const tileSpaceCameraQueryGeometry = cameraQueryGeometry.map((c) => tileID.getTilePoint(c));

                    tileResults.push({
                        tile,
                        tileID: allowWorldCopies ? tileID : tileID.unwrapTo(0),
                        queryGeometry: tileSpaceQueryGeometry,
                        cameraQueryGeometry: tileSpaceCameraQueryGeometry,
                        scale
                    });
                }
            }
        }

        return tileResults;
    }

    private transformBbox(geom: Point[], project: (point: Point) => MercatorCoordinate, checkWrap: boolean): MercatorCoordinate[] {
        let transformed = geom.map(project);
        if (checkWrap) {
            // If the projection does not allow world copies, then a bounding box may span the antimeridian and
            // instead of a bounding box going from 179°E to 179°W, it goes from 179°W to 179°E and covers the entire
            // planet except for what should be inside it.
            const bounds = Bounds.fromPoints(geom);
            bounds.shrinkBy(Math.min(bounds.width(), bounds.height()) * 0.001);
            const projected = bounds.map(project);

            const newBounds = Bounds.fromPoints(transformed); 

            if (!newBounds.covers(projected)) {
                transformed = transformed.map((coord) => coord.x > 0.5 ?
                    new MercatorCoordinate(coord.x - 1, coord.y, coord.z) :
                    coord
                );
            }
        }
        return transformed;
    }

    getVisibleCoordinates(symbolLayer?: boolean): Array<OverscaledTileID> {
        const coords = this.getRenderableIds(symbolLayer).map((id) => this._tiles[id].tileID);
        if (this.transform) {
            this.transform.populateCache(coords);
        }
        return coords;
    }

    hasTransition() {
        if (this._source.hasTransition()) {
            return true;
        }

        if (isRasterType(this._source.type) && this._rasterFadeDuration > 0) {
            const now = browser.now();
            for (const id in this._tiles) {
                const tile = this._tiles[id];
                if (tile.fadeEndTime >= now) {
                    return true;
                }
            }
        }

        return false;
    }

    setRasterFadeDuration(fadeDuration: number) {
        this._rasterFadeDuration = fadeDuration;
    }

    /**
     * Set the value of a particular state for a feature
     */
    setFeatureState(sourceLayer: string, featureId: number | string, state: any) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        this._state.updateState(sourceLayer, featureId, state);
    }

    /**
     * Resets the value of a particular state key for a feature
     */
    removeFeatureState(sourceLayer?: string, featureId?: number | string, key?: string) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        this._state.removeFeatureState(sourceLayer, featureId, key);
    }

    /**
     * Get the entire state object for a feature
     */
    getFeatureState(sourceLayer: string, featureId: number | string) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        return this._state.getState(sourceLayer, featureId);
    }

    /**
     * Sets the set of keys that the tile depends on. This allows tiles to
     * be reloaded when their dependencies change.
     */
    setDependencies(tileKey: string, namespace: string, dependencies: Array<string>) {
        const tile = this._tiles[tileKey];
        if (tile) {
            tile.setDependencies(namespace, dependencies);
        }
    }

    /**
     * Reloads all tiles that depend on the given keys.
     */
    reloadTilesForDependencies(namespaces: Array<string>, keys: Array<string>) {
        for (const id in this._tiles) {
            const tile = this._tiles[id];
            if (tile.hasDependency(namespaces, keys)) {
                this._reloadTile(id, 'reloading');
            }
        }
        this._cache.filter(tile => !tile.hasDependency(namespaces, keys));
    }
}

SourceCache.maxOverzooming = 10;
SourceCache.maxUnderzooming = 3;

function compareTileId(a: OverscaledTileID, b: OverscaledTileID): number {
    // Different copies of the world are sorted based on their distance to the center.
    // Wrap values are converted to unsigned distances by reserving odd number for copies
    // with negative wrap and even numbers for copies with positive wrap.
    const aWrap = Math.abs(a.wrap * 2) - +(a.wrap < 0);
    const bWrap = Math.abs(b.wrap * 2) - +(b.wrap < 0);
    return a.overscaledZ - b.overscaledZ || bWrap - aWrap || b.canonical.y - a.canonical.y || b.canonical.x - a.canonical.x;
}

function isRasterType(type) {
    return type === 'raster' || type === 'image' || type === 'video';
}

import {create as createSource} from '../source/source';

import {VectorTileStrategy, type TileResult} from './vector_tile_manager';
import {RasterTileStrategy} from './raster_tile_manager';
import {TileStore} from './tile_store';
import {OverscaledTileID, sortTileIDs} from './tile_id';
import {Tile} from './tile';
import {type Context} from '../gl/context';
import Point from '@mapbox/point-geometry';
import {now} from '../util/time_control';
import {SourceFeatureState} from '../source/source_state';
import {ErrorEvent, Event, Evented} from '../util/evented';
import {config} from '../util/config';

import type {Source} from '../source/source';
import type {Map} from '../ui/map';
import type {Style} from '../style/style';
import type {Dispatcher} from '../util/dispatcher';
import type {IReadonlyTransform, ITransform} from '../geo/transform_interface';
import type {TileState} from './tile';
import type {TileReloadStrategy} from './tile_reload_strategy';
import type {ICanonicalTileID, SourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {MapSourceDataEvent} from '../ui/events';
import type {Terrain} from '../render/terrain';
import type {CanvasSourceSpecification} from '../source/canvas_source';
import {coveringTiles, coveringZoomLevel} from '../geo/projection/covering_tiles';

/**
 * Strategy interface for tile-type-specific behavior
 */
export interface TileManagerStrategy {
    /**
     * Determine whether a tile is renderable
     */
    isTileRenderable(tile: Tile, symbolLayer?: boolean): boolean;

    /**
     * Check if the manager still has tile transitions
     */
    hasTransition?(): boolean;

    /**
     * Process the tile when retrieved from cache
     */
    onTileRetrievedFromCache?(tile: Tile): void;

    /**
     * Perform post-update logic
     */
    onFinishUpdate(idealTileIDs: OverscaledTileID[], retain: Record<string, OverscaledTileID>, sourceMinZoom: number, sourceMaxZoom: number, fadeDuration: number): string[];

    /**
     * Release tiles held for fading (optional, mainly for vector tiles with symbols)
     */
    releaseSymbolFadeTiles?(): void;

    /**
     * Set raster fade duration (optional, only for raster tiles)
     */
    setRasterFadeDuration?(fadeDuration: number): void;

    /**
     * Tiles in a given query geometry
     */
    tilesIn?(pointQueryGeometry: Array<Point>, maxPitchScaleFactor: number, has3DLayer: boolean, transform: ITransform, terrain: Terrain): TileResult[];
}

/**
 * @internal
 * `TileManager` is responsible for
 *
 *  - creating an instance of `Source`
 *  - caching tiles loaded from an instance of `Source`
 *  - handling incoming source data events events from `Map` and coordinating updates
 *  - providing the current renderable tile coordinates to the `Painter`
 *  - loading the tiles needed to render a given viewport
 *  - retaining the tiles needed as substitutes for pending loading tiles
 *  - reloading tiles when source data or dependencies change
 *  - handling tile expiration and refresh timers
 *  - unloading cached tiles not needed to render a given viewport
 *  - managing tile state and feature state
 */
export class TileManager extends Evented {
    id: string;
    dispatcher: Dispatcher;
    map: Map;
    style: Style;

    _source: Source;
    _store: TileStore;
    _strategy: TileManagerStrategy;

    /**
     * @internal
     * signifies that the TileJSON is loaded if applicable.
     * if the source type does not come with a TileJSON, the flag signifies the
     * source data has loaded (i.e geojson has been tiled on the worker and is ready)
     */
    _sourceLoaded: boolean;

    _sourceErrored: boolean;
    _prevLng: number;
    _timers: Record<string, ReturnType<typeof setTimeout>>;
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

    /**
     * Maximum number of zoom levels to seek descendent substitute tiles for unloaded ideal tiles.
     * Warning: this value increases tile processing logic exponentially with each additional zoom level.
     */
    static maxOverzooming: number = 3;
    /**
     * Maximum number of zoom levels to seek ancestor substitute tiles for unloaded ideal tiles.
     */
    static maxUnderzooming: number = 10;

    /**
     * Overridable function for extending classes to process the tile when retrieved from cache.
     */
    constructor(id: string, options: SourceSpecification | CanvasSourceSpecification, dispatcher: Dispatcher, type: 'vector' | 'raster' | string) {
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
        this._store = new TileStore(tile => this._unloadTile(tile));
        this._strategy = type === 'raster'
            ? new RasterTileStrategy(this._store)
            : new VectorTileStrategy(this._store);

        this._timers = {};
        this._maxTileCacheSize = null;
        this._maxTileCacheZoomLevels = null;

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

        const tiles = this._store.getTiles();
        for (const id in tiles) {
            const tile = tiles[id];
            if (tile.state !== 'loaded' && tile.state !== 'errored')
                return false;
        }
        return true;
    }

    getSource(): Source {
        return this._source;
    }

    getState(): SourceFeatureState {
        return this._state;
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

        const tiles = this._store.getTiles();
        this._state.coalesceChanges(tiles, this.map ? this.map.painter : null);
        for (const id in tiles) {
            const tile = tiles[id];
            tile.upload(context);
            tile.prepare(this.map.style.imageManager);
        }
    }

    getRenderableIds(symbolLayer?: boolean): Array<string> {
        const renderables: Array<Tile> = [];
        const tiles = this._store.getTiles();
        for (const id in tiles) {
            const tile = tiles[id];
            if (this._strategy.isTileRenderable(tile, symbolLayer)) {
                renderables.push(tile);
            }
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
        const sortedIDs = sortTileIDs(renderables.map(tile => tile.tileID));
        return sortedIDs.map(id => id.key);
    }

    hasRenderableParent(tileID: OverscaledTileID) {
        const parentZ = tileID.overscaledZ - 1;
        if (parentZ >= this._source.minzoom) {
            const parentTile = this.getLoadedTile(tileID.scaledTo(parentZ));
            if (parentTile) {
                return this._strategy.isTileRenderable(parentTile);
            }
        }
        return false;
    }

    /**
     * Reload tiles based on the current state of the source.
     * @param sourceDataChanged - If `true`, reload all tiles using a state of 'expired', otherwise reload only non-errored tiles using state of 'reloading'.
     * @param tileReloadStrategy - Strategy to determine which tiles should be reloaded for a specific source type.
     */
    reload(
        sourceDataChanged?: boolean,
        tileReloadStrategy?: TileReloadStrategy
    ) {
        if (this._paused) {
            this._shouldReloadOnResume = true;
            return;
        }

        this._store.resetCache();

        const tiles = this._store.getTiles();
        for (const id in tiles) {
            if (tileReloadStrategy && !this._source.shouldReloadTile(tiles[id], tileReloadStrategy)) {
                continue;
            } else if (sourceDataChanged) {
                this._reloadTile(id, 'expired');
            } else if (tiles[id].state !== 'errored') {
                this._reloadTile(id, 'reloading');
            }
        }
    }

    async _reloadTile(id: string, state: TileState) {
        const tile = this._store.getTileByID(id);

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
        tile.timeAdded = now();
        // Since self-fading applies to unloaded tiles, fadeEndTime must be updated upon load
        if (tile.selfFading) {
            tile.fadeEndTime = tile.timeAdded + this._rasterFadeDuration;
        }

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
                const borderTile = this._store.getTileByID(borderId);
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

    getTile(tileID: OverscaledTileID): Tile {
        return this._store.getTile(tileID);
    }

    getTileByID(id: string): Tile {
        return this._store.getTileByID(id);
    }

    getLoadedTile(tileID: OverscaledTileID): Tile {
        return this._store.getLoadedTile(tileID);
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
            const maxCoveringZoom = targetID.overscaledZ + TileManager.maxOverzooming;
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

        // enumerate current tiles and find the loaded descendents of each target tile
        const tiles = this._store.getTiles();
        for (const id in tiles) {
            const tile = tiles[id];
            if (!tile.hasData()) continue;

            // determine if the loaded tile (hasData) is a qualified descendent of any target tile
            for (const targetID of targetTileIDs) {
                if (tile.tileID.isChildOf(targetID)) {
                    (loadedDescendents[targetID.key] ||= []).push(tile);
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
     * Resizes the tile cache based on the current viewport's size
     * or the maxTileCacheSize option passed during map creation
     *
     * Larger viewports use more tiles and need larger caches. Larger viewports
     * are more likely to be found on devices with more memory and on pages where
     * the map is more important.
     */
    _updateCacheSize(transform: IReadonlyTransform) {
        const widthInTiles = Math.ceil(transform.width / this._source.tileSize) + 1;
        const heightInTiles = Math.ceil(transform.height / this._source.tileSize) + 1;
        const approxTilesInView = widthInTiles * heightInTiles;
        const commonZoomRange = this._maxTileCacheZoomLevels === null ?
            config.MAX_TILE_CACHE_ZOOM_LEVELS : this._maxTileCacheZoomLevels;
        const viewDependentMaxSize = Math.floor(approxTilesInView * commonZoomRange);
        const maxSize = typeof this._maxTileCacheSize === 'number' ?
            Math.min(this._maxTileCacheSize, viewDependentMaxSize) : viewDependentMaxSize;

        this._store.setMaxCacheSize(maxSize);
    }

    _handleWrapJump(lng: number) {
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
            this._store.unwrapTiles(wrapDelta);
            this._resetTileReloadTimers();
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

        this._updateCacheSize(transform);
        this._handleWrapJump(this.transform.center.lng);

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
                maxzoom: this._source.type === 'vector' && this.map._zoomLevelsToOverscale !== undefined
                    ? transform.maxZoom - this.map._zoomLevelsToOverscale 
                    : this._source.maxzoom,
                roundZoom: this.usedForTerrain ? false : this._source.roundZoom,
                reparseOverscaled: this._source.reparseOverscaled,
                terrain,
                calculateTileZoom: this._source.calculateTileZoom,
            });

            if (this._source.hasTile) {
                idealTileIDs = idealTileIDs.filter((coord) => this._source.hasTile(coord));
            }
        }

        // When tilemanager is used for terrain also load parent tiles for complete rendering of 3d terrain levels
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

        // delegate to strategy for post-update logic - returns tile ids to remove
        const removeIds = this._strategy.onFinishUpdate(idealTileIDs, retain, this._source.minzoom, this._source.maxzoom, this.map?._fadeDuration);
        for (const id of removeIds) {
            this.removeTile(id);
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

    /**
     * Set tiles to be retained on update of the source. For ideal tiles that do not have data, retain their loaded
     * children so they can be displayed as substitutes pending load of each ideal tile (to reduce flickering).
     * If no loaded children are available, fallback to seeking loaded parents as an alternative substitute.
     */
    _updateRetainedTiles(idealTileIDs: Array<OverscaledTileID>, zoom: number): Record<string, OverscaledTileID> {
        const retain: Record<string, OverscaledTileID> = {};
        const checked: Record<string, boolean> = {};
        const minCoveringZoom = Math.max(zoom - TileManager.maxUnderzooming, this._source.minzoom);

        let missingIdealIDs: Record<string, OverscaledTileID> = {};
        for (const idealID of idealTileIDs) {
            const idealTile = this._addTile(idealID);

            // retain the tile even if it's not loaded because it's an ideal tile.
            retain[idealID.key] = idealID;

            if (!idealTile.hasData()) {
                missingIdealIDs[idealID.key] = idealID;
            }
        }

        missingIdealIDs = this._retainLoadedChildren(missingIdealIDs, retain);

        // for remaining missing tiles with incomplete child coverage, seek a loaded parent tile
        const tiles = this._store.getTiles();
        for (const missingKey in missingIdealIDs) {
            const missingID = missingIdealIDs[missingKey];
            let tile = tiles[missingKey];

            // As we ascend up the tile pyramid of the ideal tile, we check whether the parent
            // tile has been previously requested (and errored because we only loop over tiles with no data)
            // in order to determine if we need to request its parent.
            let parentWasRequested = tile?.wasRequested();

            for (let overscaledZ = missingID.overscaledZ - 1; overscaledZ >= minCoveringZoom; --overscaledZ) {
                const parentId = missingID.scaledTo(overscaledZ);

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
     * Add a tile, given its coordinate, to the pyramid.
     */
    _addTile(tileID: OverscaledTileID): Tile {
        let tile = this._store.getTile(tileID);
        if (tile)
            return tile;

        tile = this._store.getTileFromCache(tileID);
        if (tile) {
            //allow strategy to process the tile when retrieved from cache
            this._strategy.onTileRetrievedFromCache?.(tile);

            // set timer for the reloading of the tile upon expiration
            this._setTileReloadTimer(tileID.key, tile);

            // set the tileID because the cached tile could have had a different wrap value
            tile.tileID = tileID;
            this._state.initializeTileState(tile, this.map ? this.map.painter : null);
        }

        const cached = tile;

        if (!tile) {
            tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor());
            this._loadTile(tile, tileID.key, tile.state);
        }

        tile.uses++;
        this._store.addTile(tile);
        if (!cached) {
            this._source.fire(new Event('dataloading', {tile, coord: tile.tileID, dataType: 'source'}));
        }

        return tile;
    }

    /**
     * Set a timeout to reload the tile after it expires
     */
    _setTileReloadTimer(id: string, tile: Tile) {
        this._clearTileReloadTimer(id);

        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            const reload = () => {
                this._reloadTile(id, 'expired');
                delete this._timers[id];
            };
            this._timers[id] = setTimeout(reload, expiryTimeout);
        }
    }

    _clearTileReloadTimer(id: string) {
        const timeout = this._timers[id];
        if (timeout) {
            clearTimeout(timeout);
            delete this._timers[id];
        }
    }

    _resetTileReloadTimers() {
        for (const id in this._timers) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }
        const tiles = this._store.getTiles();
        for (const id in tiles) {
            this._setTileReloadTimer(id, tiles[id]);
        }
    }

    /**
     * Reload any currently renderable tiles that are match one of the incoming `tileId` x/y/z
     */
    refreshTiles(tileIds: Array<ICanonicalTileID>) {
        const tiles = this._store.getTiles();
        for (const id in tiles) {
            const tile = tiles[id];
            if (!this._strategy.isTileRenderable(tile) && tile.state != 'errored') {
                continue;
            }
            if (tileIds.some(tid => tid.equals(tile.tileID.canonical))) {
                this._reloadTile(id, 'expired');
            }
        }
    }

    clearTiles() {
        this._shouldReloadOnResume = false;
        this._paused = false;
        for (const id in this._store.getTiles()) {
            this.removeTile(id);
        }
        this._store.resetCache();
    }

    /**
     * Remove a tile, given its id, from the pyramid
     */
    removeTile(id: string) {
        const tile = this._store.getTileByID(id);
        if (!tile) return;

        tile.uses--;
        this._store.removeTile(id);
        this._clearTileReloadTimer(id);

        if (tile.uses > 0) return;

        if (tile.hasData() && tile.state !== 'reloading') {
            this._store.addTileToCache(tile);
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

        this.reload(e.sourceDataChanged, e.tileReloadStrategy);
        if (this.transform) {
            this.update(this.transform, this.terrain);
        }
        this._didEmitContent = true;
    }

    getVisibleCoordinates(symbolLayer?: boolean): Array<OverscaledTileID> {
        const tiles = this._store.getTiles();
        const renderableIds = this.getRenderableIds(symbolLayer);
        const coords = renderableIds.map(id => tiles[id].tileID);
        if (this.transform) {
            this.transform.populateCache(coords);
        }
        return coords;
    }

    hasTransition(): boolean {
        if (this._source.hasTransition()) {
            return true;
        }
        if (this._strategy.hasTransition?.()) {
            return true;
        }
        return false;
    }

    areTilesLoaded(): boolean {
        const tiles = this._store.getTiles();
        for (const id in tiles) {
            const tile = tiles[id];
            if (!(tile.state === 'loaded' || tile.state === 'errored')) {
                return false;
            }
        }
        return true;
    }

    releaseSymbolFadeTiles() {
        this._strategy.releaseSymbolFadeTiles?.();
    }

    setRasterFadeDuration(fadeDuration: number) {
        this._strategy.setRasterFadeDuration?.(fadeDuration);
    }

    tilesIn(pointQueryGeometry: Array<Point>, maxPitchScaleFactor: number, has3DLayer: boolean): TileResult[] {
        return this._strategy.tilesIn?.(pointQueryGeometry, maxPitchScaleFactor, has3DLayer, this.transform, this.terrain) ?? [];
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
        const tile = this._store.getTileByID(tileKey);
        if (tile) {
            tile.setDependencies(namespace, dependencies);
        }
    }

    /**
     * Reloads all tiles that depend on the given keys.
     */
    reloadTilesForDependencies(namespaces: Array<string>, keys: Array<string>) {
        const tiles = this._store.getTiles();
        for (const id in tiles) {
            const tile = tiles[id];
            if (tile.hasDependency(namespaces, keys)) {
                this._reloadTile(id, 'reloading');
            }
        }
        this._store.filterCache(tile => !tile.hasDependency(namespaces, keys));
    }
}

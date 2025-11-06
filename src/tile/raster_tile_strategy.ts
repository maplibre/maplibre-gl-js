import {type TileManagerStrategy} from './tile_manager';
import {type TileStore} from './tile_store';
import {type Tile, FadingDirections, FadingRoles} from './tile';
import {now} from '../util/time_control';
import type {OverscaledTileID} from './tile_id';

/**
 * Raster-specific tile management strategy
 *
 * Responsibilities specific to raster tiles:
 *  - Managing cross-fade animations between parent and child tiles
 *  - Handling edge tile fading during panning
 *  - Coordinating many-to-one fade relationships between tiles
 *  - Cleaning up tiles with raster-specific logic (immediate removal vs retainment for fading)
 */
export class RasterTileStrategy implements TileManagerStrategy {
    _store: TileStore;
    _rasterFadeDuration: number = 0;
    _maxFadingAncestorLevels: number = 5;

    constructor(store: TileStore) {
        this._store = store;
    }

    onTileLoaded(tile: Tile) {
        // Since self-fading applies to unloaded tiles, fadeEndTime must be updated upon load
        if (tile.selfFading) {
            tile.fadeEndTime = tile.timeAdded + this._rasterFadeDuration;
        }
    }

    onTileRetrievedFromCache(tile: Tile) {
        tile.resetFadeLogic();
    }

    onFinishUpdate(idealTileIDs: OverscaledTileID[], retain: Record<string, OverscaledTileID>, sourceMinZoom: number, sourceMaxZoom: number, _fadeDuration: number): string[] {
        if (this._rasterFadeDuration > 0) {
            this._updateFadingTiles(idealTileIDs, retain, sourceMinZoom, sourceMaxZoom);
        }

        const removeIds = [];
        const tiles = this._store.getTiles();
        for (const id in tiles) {
            if (retain[id]) continue;
            removeIds.push(id);
        }
        return removeIds;
    }

    isTileRenderable(tile: Tile): boolean {
        return (
            tile?.hasData() &&
            (!tile.fadeEndTime || tile.fadeOpacity > 0)
        );
    }

    hasTransition(): boolean {
        if (this._rasterFadeDuration === 0) return false;

        const currentTime = now();
        const tiles = this._store.getTiles();
        for (const id in tiles) {
            if (tiles[id].fadeEndTime >= currentTime) {
                return true;
            }
        }

        return false;
    }

    setRasterFadeDuration(fadeDuration: number) {
        this._rasterFadeDuration = fadeDuration;
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
    _updateFadingTiles(idealTileIDs: OverscaledTileID[], retain: Record<string, OverscaledTileID>, sourceMinZoom: number, sourceMaxZoom: number) {
        const currentTime: number = now();
        const tiles = this._store.getTiles();
        const edgeTileIDs: Set<OverscaledTileID> = this._store.getEdgeTiles(idealTileIDs);

        for (const idealID of idealTileIDs) {
            const idealTile = tiles[idealID.key];

            // reset any previously departing(ed) tiles that are now ideal tiles
            if (idealTile.fadingDirection === FadingDirections.Departing || idealTile.fadeOpacity === 0) {
                idealTile.resetFadeLogic();
            }

            const parentIsFader = this._updateFadingAncestor(idealTile, retain, currentTime, sourceMinZoom);
            if (parentIsFader) continue;

            const childIsFader = this._updateFadingDescendents(idealTile, retain, currentTime, sourceMaxZoom);
            if (childIsFader) continue;

            const edgeIsFader = this._updateFadingEdge(idealTile, edgeTileIDs, currentTime);
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
    _updateFadingAncestor(idealTile: Tile, retain: Record<string, OverscaledTileID>, now: number, sourceMinZoom: number): boolean {
        if (!idealTile.hasData()) return false;

        const {tileID: idealID, fadingRole, fadingDirection, fadingParentID} = idealTile;
        // ideal tile already has fading parent - retain and return
        if (fadingRole === FadingRoles.Base && fadingDirection === FadingDirections.Incoming && fadingParentID) {
            retain[fadingParentID.key] = fadingParentID;
            return true;
        }

        // find a loaded parent tile to fade with the ideal tile
        const minAncestorZ = Math.max(idealID.overscaledZ - this._maxFadingAncestorLevels, sourceMinZoom);
        for (let ancestorZ = idealID.overscaledZ - 1; ancestorZ >= minAncestorZ; ancestorZ--) {
            const ancestorID = idealID.scaledTo(ancestorZ);
            const ancestorTile = this._store.getLoadedTile(ancestorID);
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
    _updateFadingDescendents(idealTile: Tile, retain: Record<string, OverscaledTileID>, now: number, sourceMaxZoom: number): boolean {
        if (!idealTile.hasData()) return false;

        // search first level of descendents (4 tiles)
        const idealChildren = idealTile.tileID.children(sourceMaxZoom);
        let hasFader = this._updateFadingChildren(idealTile, idealChildren, retain, now, sourceMaxZoom);
        if (hasFader) return true;

        // search second level of descendents (16 tiles)
        for (const childID of idealChildren) {
            const grandChildIDs = childID.children(sourceMaxZoom);
            if (this._updateFadingChildren(idealTile, grandChildIDs, retain, now, sourceMaxZoom)) {
                hasFader = true;
            }
        }

        return hasFader;
    }

    _updateFadingChildren(idealTile: Tile, childIDs: OverscaledTileID[], retain: Record<string, OverscaledTileID>, now: number, sourceMaxZoom: number): boolean {
        if (childIDs[0].overscaledZ >= sourceMaxZoom) return false;
        let foundFader = false;

        // find loaded child tiles to fade with the ideal tile
        for (const childID of childIDs) {
            const childTile = this._store.getLoadedTile(childID);
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
}

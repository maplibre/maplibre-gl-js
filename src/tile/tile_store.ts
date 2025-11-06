import {sortTileIDs} from './tile_id';
import {TileCache} from './tile_cache';
import type {OverscaledTileID} from './tile_id';
import type {Tile} from './tile';

export class TileStore  {
    _tiles: Record<string, Tile> = {};
    _cache: TileCache;

    constructor(onCacheRemove: (tile: Tile) => void) {
        this._cache = new TileCache(0, onCacheRemove);
    }

    addTile(tile: Tile) {
        this._tiles[tile.tileID.key] = tile;
    }

    getTileByID(id: string): Tile {
        return this._tiles[id];
    }

    getTiles(): Record<string, Tile> {
        return this._tiles;
    }

    getTilesSorted(): Array<Tile> {
        const tileIDs: OverscaledTileID[] = [];
        for (const id in this._tiles) {
            tileIDs.push(this._tiles[id].tileID);
        }
        return sortTileIDs(tileIDs).map(tileID => this._tiles[tileID.key]);
    }

    getTileKeysSorted(): Array<string> {
        return this.getTilesSorted().map(tile => tile.tileID.key);
    }

    unwrapTiles(wrapDelta: number) {
        const nextTiles: Record<string, Tile> = {};

        for (const id in this._tiles) {
            const tile = this._tiles[id];
            tile.tileID = tile.tileID.unwrapTo(tile.tileID.wrap + wrapDelta);
            nextTiles[tile.tileID.key] = tile;
        }

        this._tiles = nextTiles;
    }

    getLoadedTile(tileID: OverscaledTileID): Tile | null {
        const tile = this._tiles[tileID.key];
        return tile?.hasData() ? tile : null;
    }

    removeTileByID(id: string) {
        delete this._tiles[id];
    }

    addTileToCache(tile: Tile) {
        this._cache.add(tile.tileID, tile, tile.getExpiryTimeout());
    }

    getTileFromCache(tileID: OverscaledTileID): Tile | null {
        return this._cache.getAndRemove(tileID);
    }

    resetCache() {
        this._cache.reset();
    }

    setMaxCacheSize(max: number) {
        this._cache.setMaxSize(max);
    }

    filterCache(condition: (tile: Tile) => boolean) {
        this._cache.filter(condition);
    }

    /**
     * For a given set of tile ids, returns the edge tile ids for the bounding box.
     */
    getEdgeTiles(tileIDs: OverscaledTileID[]): Set<OverscaledTileID> {
        if (!tileIDs.length) return new Set<OverscaledTileID>();

        // set a common zoom for calculation (highest zoom) to reproject all tiles to this same zoom
        const targetZ = Math.max(...tileIDs.map(id => id.canonical.z));

        // vars to store the min and max tile x/y coordinates for edge finding
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        // project all tiles to targetZ while maintaining the reference to the original tile
        const projected: {id: OverscaledTileID; x: number; y: number}[] = [];
        for (const id of tileIDs) {
            const {x, y, z} = id.canonical;
            const scale = Math.pow(2, targetZ - z);
            const px = x * scale;
            const py = y * scale;

            projected.push({id, x: px, y: py});

            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        }

        // find edge tiles using the reprojected tile ids
        const edgeTiles: Set<OverscaledTileID> = new Set<OverscaledTileID>();
        for (const p of projected) {
            if (p.x === minX || p.x === maxX || p.y === minY || p.y === maxY) {
                edgeTiles.add(p.id);
            }
        }

        return edgeTiles;
    }

    getCache() {
        return this._cache;
    }
}

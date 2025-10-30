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

    getTile(tileID: OverscaledTileID): Tile {
        return this._tiles[tileID.key];
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

    removeTile(id: string) {
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
}

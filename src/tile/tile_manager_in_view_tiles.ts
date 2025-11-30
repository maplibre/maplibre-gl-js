import Point from '@mapbox/point-geometry';
import {type LayerFeatureStates} from '../source/source_state';
import {type Tile} from './tile';
import {compareTileId, type OverscaledTileID} from './tile_id';

export class InViewTiles {
    private _tiles: Record<string, Tile> = {};

    public handleWrapJump(wrapDelta: number) {
        const tiles: Record<string, Tile> = {};
        for (const id in this._tiles) {
            const tile = this._tiles[id];
            tile.tileID = tile.tileID.unwrapTo(tile.tileID.wrap + wrapDelta);
            tiles[tile.tileID.key] = tile;
        }
        this._tiles = tiles;
    }

    public setFeatureState(featuresChanged: LayerFeatureStates, painter: any) {
        for (const id in this._tiles) {
            const tile = this._tiles[id];
            tile.setFeatureState(featuresChanged, painter);
        }
    }

    public getAllTiles(): Tile[] {
        return Object.values(this._tiles);
    }

    public getAllIds(sorted = false): string[] {
        if (sorted) {
            return Object.values(this._tiles).map(tile => tile.tileID).sort(compareTileId).map(id => id.key);
        }
        return Object.keys(this._tiles);
    }

    public getTileById(key: string): Tile | undefined {
        return this._tiles[key];
    }

    public setTile(key: string, tile: Tile) {
        this._tiles[key] = tile;
    }

    public deleteTileById(key: string) {
        delete this._tiles[key];
    }

    /**
     * Get a currently loaded tile.
     * - a cached tile is not a loaded tile
     * @returns the tile if it's in view and had data, null otherwise.
     */
    public getLoadedTile(tileID: OverscaledTileID): Tile | null {
        const tile = this.getTileById(tileID.key);
        if (tile?.hasData()) {
            return tile;
        }
        return null;
    }

    public isIdRenderable(id: string, symbolLayer: boolean = false) {
        return this.getTileById(id)?.isRenderable(symbolLayer);
    }

    public getRenderableIds(bearingInRadians: number = 0, symbolLayer?: boolean): Array<string> {
        const renderables: Array<Tile> = [];
        for (const id of this.getAllIds()) {
            if (this.isIdRenderable(id, symbolLayer)) {
                renderables.push(this.getTileById(id));
            }
        }
        if (symbolLayer) {
            return renderables.sort((a_: Tile, b_: Tile) => {
                const a = a_.tileID;
                const b = b_.tileID;
                const rotatedA = (new Point(a.canonical.x, a.canonical.y))._rotate(-bearingInRadians);
                const rotatedB = (new Point(b.canonical.x, b.canonical.y))._rotate(-bearingInRadians);
                return a.overscaledZ - b.overscaledZ || rotatedB.y - rotatedA.y || rotatedB.x - rotatedA.x;
            }).map(tile => tile.tileID.key);
        }
        return renderables.map(tile => tile.tileID).sort(compareTileId).map(id => id.key);
    }
}
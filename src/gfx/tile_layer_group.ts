import type {OverscaledTileID} from '../tile/tile_id';
import type {Drawable} from './drawable';

/**
 * Container for drawables organized by layer and tile.
 * Each TileLayerGroup belongs to one layer and manages drawables
 * for all tiles visible for that layer.
 */
export class TileLayerGroup {
    layerId: string;
    _drawablesByTile: Map<string, Drawable[]>;

    constructor(layerId: string) {
        this.layerId = layerId;
        this._drawablesByTile = new Map();
    }

    addDrawable(tileID: OverscaledTileID, drawable: Drawable): void {
        const key = tileID.key.toString();
        let list = this._drawablesByTile.get(key);
        if (!list) {
            list = [];
            this._drawablesByTile.set(key, list);
        }
        list.push(drawable);
    }

    removeDrawablesForTile(tileID: OverscaledTileID): void {
        const key = tileID.key.toString();
        const drawables = this._drawablesByTile.get(key);
        if (drawables) {
            for (const d of drawables) {
                d.destroy();
            }
            this._drawablesByTile.delete(key);
        }
    }

    hasDrawablesForTile(tileID: OverscaledTileID): boolean {
        return this._drawablesByTile.has(tileID.key.toString());
    }

    getDrawablesForTile(tileID: OverscaledTileID): Drawable[] {
        return this._drawablesByTile.get(tileID.key.toString()) || [];
    }

    getAllDrawables(): Drawable[] {
        const all: Drawable[] = [];
        for (const drawables of this._drawablesByTile.values()) {
            all.push(...drawables);
        }
        return all;
    }

    /**
     * Remove drawables matching predicate (for stale tile cleanup).
     */
    removeDrawablesIf(predicate: (d: Drawable) => boolean): void {
        for (const [key, drawables] of this._drawablesByTile.entries()) {
            const remaining: Drawable[] = [];
            for (const d of drawables) {
                if (predicate(d)) {
                    d.destroy();
                } else {
                    remaining.push(d);
                }
            }
            if (remaining.length === 0) {
                this._drawablesByTile.delete(key);
            } else {
                this._drawablesByTile.set(key, remaining);
            }
        }
    }

    /**
     * Get the set of tile keys currently tracked.
     */
    getTileKeys(): Set<string> {
        return new Set(this._drawablesByTile.keys());
    }

    clear(): void {
        for (const drawables of this._drawablesByTile.values()) {
            for (const d of drawables) {
                d.destroy();
            }
        }
        this._drawablesByTile.clear();
    }

    destroy(): void {
        this.clear();
    }
}

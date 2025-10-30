import {TileManager} from './tile_manager';
import type {Tile} from './tile';
import type {OverscaledTileID} from './tile_id';

/**
 * @internal
 * `VectorTileManager` extends `TileManager` with vector-specific functionality,
 * primarily handling symbol fade logic for smooth label transitions.
 *
 * Responsibilities specific to vector tiles:
 *  - Managing symbol fade hold duration to prevent label flicker
 *  - Retaining tiles with symbols for gradual fade out
 *  - Coordinating symbol placement across tile boundaries
 */
export class VectorTileManager extends TileManager {
    override _onTileRetrievedFromCache(_tile: Tile) {}
    override _onFinishUpdate(_idealTileIDs: OverscaledTileID[], _retain: Record<string, OverscaledTileID>) {}

    /**
     * @override
     * Remove vector tiles that are no longer retained and also not needed for symbol fading.
     */
    override _cleanUpTiles(retain: Record<string, OverscaledTileID>) {
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
     * Release all tiles that are held for symbol fading.
     * This is useful when forcing an immediate cleanup without waiting for fade completion.
     */
    releaseSymbolFadeTiles() {
        for (const id in this._tiles) {
            if (this._tiles[id].holdingForSymbolFade()) {
                this._removeTile(id);
            }
        }
    }

    override _isIdRenderable(id: string, symbolLayer: boolean): boolean {
        const tile = this._tiles[id];
        return (
            tile?.hasData() &&
            (symbolLayer || !tile.holdingForSymbolFade())
        );
    }

    override hasTransition() {
        return this._source.hasTransition();
    }
}

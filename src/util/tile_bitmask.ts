import {CanonicalTileID} from '../source/tile_id';

const InvalidationTreeDepth = 7;

function packTileCoord(zoom: number, x: number, y: number): number {
    return (zoom << (2 * InvalidationTreeDepth)) | (x << InvalidationTreeDepth) | y;
}

function unpackTileCoord(coord: number): { zoom: number; x: number; y: number } {
    const mask = (1 << InvalidationTreeDepth) - 1;
    return {
        zoom: coord >> (2 * InvalidationTreeDepth),
        x: (coord >> InvalidationTreeDepth) & mask,
        y: coord & mask,
    };
}

enum Composition {
    MIXED = 0,
    MARKED = 1,
}

export type SerializedTileBitmask = Int32Array;

/**
 * Stores a mask of tile coordinates as a quadtree.
 */
export class TileBitmask {
    /**
     * Maximum zoom level tracked by this tree, inclusive.
     */
    public static readonly MaxZoom = InvalidationTreeDepth - 1;
    /**
     * Number of tiles along a single axis at the maximum zoom level.
     */
    public static readonly MaxZoomTiles = 1 << TileBitmask.MaxZoom;

    private readonly tree: Map<number, Composition>;

    constructor() {
        this.tree = new Map<number, Composition>();
    }

    public isMarked(tileId: CanonicalTileID): boolean {
        const {z: zoom, x, y} = tileId;
        for (let z = 0; z <= TileBitmask.MaxZoom; z++) {
            const zoomedX = x >> (zoom - z);
            const zoomedY = y >> (zoom - z);
            const composition = this.tree.get(packTileCoord(z, zoomedX, zoomedY));
            if (composition == null) {
                return false;
            }
            if (z === zoom || composition !== Composition.MIXED) {
                return true;
            }
        }
        throw new Error(`Invalid quadtree: Request for ${zoom} ${x} ${y} ran off the end of the tree`);
    }

    /**
     * Clears all descendants of a tile from the tree.  This can be used after setting the composition of a tile
     * to MARKED (since that implies that all descendants are also MARKED)
     * @param zoom
     * @param x
     * @param y
     */
    private clearDescendants(zoom: number, x: number, y: number) {
        if (zoom >= TileBitmask.MaxZoom) {
            return;
        }

        const rootX = x << 1;
        const rootY = y << 1;
        for (let childX = rootX; childX <= rootX + 1; childX++) {
            for (let childY = rootY; childY <= rootY + 1; childY++) {
                if (this.tree.delete(packTileCoord(zoom + 1, childX, childY))) {
                    this.clearDescendants(zoom + 1, childX, childY);
                }
            }
        }
    }

    /**
     * Used after marking a tile to compact the quadtree for the case where all 4 children of a tile are marked, by
     * replacing the 4 marked children with a single marked parent.
     * @param zoom
     * @param x
     * @param y
     */
    private compactAncestors(zoom: number, x: number, y: number) {
        while (zoom > 0) {
            const rootX = x & ~1;
            const rootY = y & ~1;
            // check that all siblings are marked
            for (let siblingX = rootX; siblingX <= rootX + 1; siblingX++) {
                for (let siblingY = rootY; siblingY <= rootY + 1; siblingY++) {
                    const siblingComposition = this.tree.get(packTileCoord(zoom, siblingX, siblingY));
                    if (siblingComposition !== Composition.MARKED) {
                        return;
                    }
                }
            }
            // delete entries for all siblings
            for (let siblingX = rootX; siblingX <= rootX + 1; siblingX++) {
                for (let siblingY = rootY; siblingY <= rootY + 1; siblingY++) {
                    this.tree.delete(packTileCoord(zoom, siblingX, siblingY));
                }
            }
            // set parent as marked
            zoom--;
            x >>= 1;
            y >>= 1;
            this.tree.set(packTileCoord(zoom, x, y), Composition.MARKED);
            // continue to visit the parent's parent
        }
    }

    public mark(zoom: number, x: number, y: number) {
        const insertZoom = Math.min(TileBitmask.MaxZoom, zoom);
        for (let z = 0; z <= insertZoom; z++) {
            const zoomedX = x >> (zoom - z);
            const zoomedY = y >> (zoom - z);
            const key = packTileCoord(z, zoomedX, zoomedY);
            const composition = this.tree.get(key);
            if (composition === Composition.MARKED) {
                // subtree already marked so we can early exit
                return;
            }
            if (z === insertZoom) {
                this.tree.set(key, Composition.MARKED);
                this.clearDescendants(z, zoomedX, zoomedY);
                this.compactAncestors(z, zoomedX, zoomedY);
                return;
            }
            if (composition !== Composition.MIXED) {
                this.tree.set(key, Composition.MIXED);
            }
        }
        throw new Error(`Invalid quadtree: Mark request for ${zoom} ${x} ${y} ran off the end of the tree`);
    }

    /**
     * Slow debugging method that gets all definitively marked tiles.
     */
    public getMarkedTiles() {
        const markedTiles = [];
        for (const [key, val] of this.tree.entries()) {
            if (val !== Composition.MARKED) {
                continue;
            }
            markedTiles.push(unpackTileCoord(key));
        }
        return markedTiles;
    }

    public serialize(): SerializedTileBitmask {
        const buffer = new Int32Array(this.tree.size);
        let i = 0;
        for (const [key, val] of this.tree.entries()) {
            buffer[i++] = (key << 2) | val;
        }
        return buffer;
    }

    public static deserialize(ser: SerializedTileBitmask): TileBitmask {
        const result = new TileBitmask();
        for (const key of ser) {
            result.tree.set(key >> 2, key & 3);
        }
        return result;
    }
}

import KDBush from 'kdbush';
import {EXTENT} from '../data/extent';

import {SymbolInstanceArray} from '../data/array_types.g';

import type {SymbolInstance} from '../data/array_types.g';
import type {OverscaledTileID} from '../source/tile_id';
import type {SymbolBucket} from '../data/bucket/symbol_bucket';
import type {StyleLayer} from '../style/style_layer';
import type {Tile} from '../source/tile';

/*
    The CrossTileSymbolIndex generally works on the assumption that
    a conceptual "unique symbol" can be identified by the text of
    the label combined with the anchor point. The goal is to assign
    these conceptual "unique symbols" a shared crossTileID that can be
    used by Placement to keep fading opacity states consistent and to
    deduplicate labels.

    The CrossTileSymbolIndex indexes all the current symbol instances and
    their crossTileIDs. When a symbol bucket gets added or updated, the
    index assigns a crossTileID to each of it's symbol instances by either
    matching it with an existing id or assigning a new one.
*/

// Round anchor positions to roughly 4 pixel grid
const roundingFactor = 512 / EXTENT / 2;

export const KDBUSH_THRESHHOLD = 128;

interface SymbolsByKeyEntry {
    index?: KDBush;
    positions?: {x: number; y: number}[];
    crossTileIDs: number[];
}

class TileLayerIndex {
    _symbolsByKey: Record<number, SymbolsByKeyEntry> = {};

    constructor(public tileID: OverscaledTileID, symbolInstances: SymbolInstanceArray, public bucketInstanceId: number) {
        // group the symbolInstances by key
        const symbolInstancesByKey = new Map<number, SymbolInstance[]>();
        for (let i = 0; i < symbolInstances.length; i++) {
            const symbolInstance = symbolInstances.get(i);
            const key = symbolInstance.key;
            const instances = symbolInstancesByKey.get(key);
            if (instances) {
                // This tile may have multiple symbol instances with the same key
                // Store each one along with its coordinates
                instances.push(symbolInstance);
            } else {
                symbolInstancesByKey.set(key, [symbolInstance]);
            }
        }

        // index the SymbolInstances in this each bucket
        for (const [key, symbols] of symbolInstancesByKey) {
            const positions = symbols.map(symbolInstance => ({x: Math.floor(symbolInstance.anchorX * roundingFactor), y: Math.floor(symbolInstance.anchorY * roundingFactor)}));
            const crossTileIDs = symbols.map(v => v.crossTileID);
            const entry: SymbolsByKeyEntry = {positions, crossTileIDs};

            // once we get too many symbols for a given key, it becomes much faster to index it before queries
            if (entry.positions.length > KDBUSH_THRESHHOLD) {

                const index = new KDBush(entry.positions.length, 16, Uint16Array);
                for (const {x, y} of entry.positions) index.add(x, y);
                index.finish();

                // clear all references to the original positions data
                delete entry.positions;
                entry.index = index;
            }

            this._symbolsByKey[key] = entry;
        }
    }

    // Converts the coordinates of the input symbol instance into coordinates that be can compared
    // against other symbols in this index. Coordinates are:
    // (1) local-tile-based (so after correction we get x,y values relative to our local anchorX/Y)
    // (2) converted to the z-scale of this TileLayerIndex
    // (3) down-sampled by "roundingFactor" from tile coordinate precision in order to be
    //     more tolerant of small differences between tiles.
    getScaledCoordinates(symbolInstance: SymbolInstance, childTileID: OverscaledTileID): {x: number; y: number} {
        const {x: localX, y: localY, z: localZ} = this.tileID.canonical;
        const {x, y, z} = childTileID.canonical;

        const zDifference = z - localZ;
        const scale = roundingFactor / Math.pow(2, zDifference);
        const xWorld = (x * EXTENT + symbolInstance.anchorX) * scale;
        const yWorld = (y * EXTENT + symbolInstance.anchorY) * scale;
        const xOffset = localX * EXTENT * roundingFactor;
        const yOffset = localY * EXTENT * roundingFactor;
        const result =  {
            x: Math.floor(xWorld - xOffset),
            y: Math.floor(yWorld - yOffset)
        };

        return result;
    }

    findMatches(symbolInstances: SymbolInstanceArray, newTileID: OverscaledTileID, zoomCrossTileIDs: {
        [crossTileID: number]: boolean;
    }) {
        const tolerance = this.tileID.canonical.z < newTileID.canonical.z ? 1 : Math.pow(2, this.tileID.canonical.z - newTileID.canonical.z);

        for (let i = 0; i < symbolInstances.length; i++) {
            const symbolInstance = symbolInstances.get(i);
            if (symbolInstance.crossTileID) {
                // already has a match, skip
                continue;
            }

            const entry = this._symbolsByKey[symbolInstance.key];
            if (!entry) {
                // No symbol with this key in this bucket
                continue;
            }

            const scaledSymbolCoord = this.getScaledCoordinates(symbolInstance, newTileID);

            if (entry.index) {
                // Return any symbol with the same keys whose coordinates are within 1
                // grid unit. (with a 4px grid, this covers a 12px by 12px area)
                const indexes = entry.index.range(
                    scaledSymbolCoord.x - tolerance,
                    scaledSymbolCoord.y - tolerance,
                    scaledSymbolCoord.x + tolerance,
                    scaledSymbolCoord.y + tolerance).sort();

                for (const i of indexes) {
                    const crossTileID = entry.crossTileIDs[i];

                    if (!zoomCrossTileIDs[crossTileID]) {
                        // Once we've marked ourselves duplicate against this parent symbol,
                        // don't let any other symbols at the same zoom level duplicate against
                        // the same parent (see issue #5993)
                        zoomCrossTileIDs[crossTileID] = true;
                        symbolInstance.crossTileID = crossTileID;
                        break;
                    }
                }
            } else if (entry.positions) {
                for (let i = 0; i < entry.positions.length; i++) {
                    const thisTileSymbol = entry.positions[i];
                    const crossTileID = entry.crossTileIDs[i];

                    // Return any symbol with the same keys whose coordinates are within 1
                    // grid unit. (with a 4px grid, this covers a 12px by 12px area)
                    if (Math.abs(thisTileSymbol.x - scaledSymbolCoord.x) <= tolerance &&
                        Math.abs(thisTileSymbol.y - scaledSymbolCoord.y) <= tolerance &&
                        !zoomCrossTileIDs[crossTileID]) {
                        // Once we've marked ourselves duplicate against this parent symbol,
                        // don't let any other symbols at the same zoom level duplicate against
                        // the same parent (see issue #5993)
                        zoomCrossTileIDs[crossTileID] = true;
                        symbolInstance.crossTileID = crossTileID;
                        break;
                    }
                }
            }
        }
    }

    getCrossTileIDsLists() {
        return Object.values(this._symbolsByKey).map(({crossTileIDs}) => crossTileIDs);
    }
}

class CrossTileIDs {
    maxCrossTileID: number;
    constructor() {
        this.maxCrossTileID = 0;
    }
    generate() {
        return ++this.maxCrossTileID;
    }
}

class CrossTileSymbolLayerIndex {
    indexes: {
        [zoom in string | number]: {
            [tileId in string | number]: TileLayerIndex;
        };
    };
    usedCrossTileIDs: {
        [zoom in string | number]: {
            [crossTileID: number]: boolean;
        };
    };
    lng: number;

    constructor() {
        this.indexes = {};
        this.usedCrossTileIDs = {};
        this.lng = 0;
    }

    /*
     * Sometimes when a user pans across the antimeridian the longitude value gets wrapped.
     * To prevent labels from flashing out and in we adjust the tileID values in the indexes
     * so that they match the new wrapped version of the map.
     */
    handleWrapJump(lng: number) {
        const wrapDelta = Math.round((lng - this.lng) / 360);
        if (wrapDelta !== 0) {
            for (const zoom in this.indexes) {
                const zoomIndexes = this.indexes[zoom];
                const newZoomIndex = {};
                for (const key in zoomIndexes) {
                    // change the tileID's wrap and add it to a new index
                    const index = zoomIndexes[key];
                    index.tileID = index.tileID.unwrapTo(index.tileID.wrap + wrapDelta);
                    newZoomIndex[index.tileID.key] = index;
                }
                this.indexes[zoom] = newZoomIndex;
            }
        }
        this.lng = lng;
    }

    addBucket(tileID: OverscaledTileID, bucket: SymbolBucket, crossTileIDs: CrossTileIDs) {
        if (this.indexes[tileID.overscaledZ] &&
            this.indexes[tileID.overscaledZ][tileID.key]) {
            if (this.indexes[tileID.overscaledZ][tileID.key].bucketInstanceId ===
                bucket.bucketInstanceId) {
                return false;
            } else {
                // We're replacing this bucket with an updated version
                // Remove the old bucket's "used crossTileIDs" now so that
                // the new bucket can claim them.
                // The old index entries themselves stick around until
                // 'removeStaleBuckets' is called.
                this.removeBucketCrossTileIDs(tileID.overscaledZ,
                    this.indexes[tileID.overscaledZ][tileID.key]);
            }
        }

        for (let i = 0; i < bucket.symbolInstances.length; i++) {
            const symbolInstance = bucket.symbolInstances.get(i);
            symbolInstance.crossTileID = 0;
        }

        if (!this.usedCrossTileIDs[tileID.overscaledZ]) {
            this.usedCrossTileIDs[tileID.overscaledZ] = {};
        }
        const zoomCrossTileIDs = this.usedCrossTileIDs[tileID.overscaledZ];

        for (const zoom in this.indexes) {
            const zoomIndexes = this.indexes[zoom];
            if (Number(zoom) > tileID.overscaledZ) {
                for (const id in zoomIndexes) {
                    const childIndex = zoomIndexes[id];
                    if (childIndex.tileID.isChildOf(tileID)) {
                        childIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
                    }
                }
            } else {
                const parentCoord = tileID.scaledTo(Number(zoom));
                const parentIndex = zoomIndexes[parentCoord.key];
                if (parentIndex) {
                    parentIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
                }
            }
        }

        for (let i = 0; i < bucket.symbolInstances.length; i++) {
            const symbolInstance = bucket.symbolInstances.get(i);
            if (!symbolInstance.crossTileID) {
                // symbol did not match any known symbol, assign a new id
                symbolInstance.crossTileID = crossTileIDs.generate();
                zoomCrossTileIDs[symbolInstance.crossTileID] = true;
            }
        }

        if (this.indexes[tileID.overscaledZ] === undefined) {
            this.indexes[tileID.overscaledZ] = {};
        }
        this.indexes[tileID.overscaledZ][tileID.key] = new TileLayerIndex(tileID, bucket.symbolInstances, bucket.bucketInstanceId);

        return true;
    }

    removeBucketCrossTileIDs(zoom: string | number, removedBucket: TileLayerIndex) {
        for (const crossTileIDs of removedBucket.getCrossTileIDsLists()) {
            for (const crossTileID of crossTileIDs) {
                delete this.usedCrossTileIDs[zoom][crossTileID];
            }
        }
    }

    removeStaleBuckets(currentIDs: {
        [k in string | number]: boolean;
    }) {
        let tilesChanged = false;
        for (const z in this.indexes) {
            const zoomIndexes = this.indexes[z];
            for (const tileKey in zoomIndexes) {
                if (!currentIDs[zoomIndexes[tileKey].bucketInstanceId]) {
                    this.removeBucketCrossTileIDs(z, zoomIndexes[tileKey]);
                    delete zoomIndexes[tileKey];
                    tilesChanged = true;
                }
            }
        }
        return tilesChanged;
    }
}

export class CrossTileSymbolIndex {
    layerIndexes: {[layerId: string]: CrossTileSymbolLayerIndex};
    crossTileIDs: CrossTileIDs;
    maxBucketInstanceId: number;
    bucketsInCurrentPlacement: {[_: number]: boolean};

    constructor() {
        this.layerIndexes = {};
        this.crossTileIDs = new CrossTileIDs();
        this.maxBucketInstanceId = 0;
        this.bucketsInCurrentPlacement = {};
    }

    addLayer(styleLayer: StyleLayer, tiles: Array<Tile>, lng: number) {
        let layerIndex = this.layerIndexes[styleLayer.id];
        if (layerIndex === undefined) {
            layerIndex = this.layerIndexes[styleLayer.id] = new CrossTileSymbolLayerIndex();
        }

        let symbolBucketsChanged = false;
        const currentBucketIDs = {};

        layerIndex.handleWrapJump(lng);

        for (const tile of tiles) {
            const symbolBucket = (tile.getBucket(styleLayer) as any as SymbolBucket);
            if (!symbolBucket || styleLayer.id !== symbolBucket.layerIds[0])
                continue;

            if (!symbolBucket.bucketInstanceId) {
                symbolBucket.bucketInstanceId = ++this.maxBucketInstanceId;
            }

            if (layerIndex.addBucket(tile.tileID, symbolBucket, this.crossTileIDs)) {
                symbolBucketsChanged = true;
            }
            currentBucketIDs[symbolBucket.bucketInstanceId] = true;
        }

        if (layerIndex.removeStaleBuckets(currentBucketIDs)) {
            symbolBucketsChanged = true;
        }

        return symbolBucketsChanged;
    }

    pruneUnusedLayers(usedLayers: Array<string>) {
        const usedLayerMap = {};
        usedLayers.forEach((usedLayer) => {
            usedLayerMap[usedLayer] = true;
        });
        for (const layerId in this.layerIndexes) {
            if (!usedLayerMap[layerId]) {
                delete this.layerIndexes[layerId];
            }
        }
    }
}

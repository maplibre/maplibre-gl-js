import Benchmark from '../lib/benchmark.ts';
import {CrossTileSymbolIndex} from '../../../src/symbol/cross_tile_symbol_index.ts';
import {OverscaledTileID} from '../../../src/tile/tile_id.ts';
import {type StyleLayer} from '../../../src/style/style_layer.ts';

const styleLayer = {
    id: 'test'
} as StyleLayer;

const SYMBOL_COUNT = 3000;

const makeSymbolInstance = (x: number, y: number, key: string, crossTileID: number = 0): any => {
    return {
        anchorX: x,
        anchorY: y,
        key,
        crossTileID
    };
};

const makeTile = (tileID: OverscaledTileID, symbolInstances: any[]): any => {
    const bucket = {
        symbolInstances: {
            get(i: number) { return symbolInstances[i]; },
            length: symbolInstances.length
        },
        layerIds: ['test']
    };
    return {
        tileID,
        getBucket: () => bucket,
        latestFeatureIndex: {}
    };
};

/**
 * Benchmarks CrossTileSymbolIndex.addLayer with 3000 symbols that have
 * pre-assigned crossTileIDs — simulating features with IDs (via promoteId
 * or generateId). All symbols share the same key and coordinates, which is
 * the pathological case for coordinate-based findMatches.
 */
export default class CrossTileSymbolIndexBench extends Benchmark {
    private _mainTile: any;
    private _childTile: any;

    async setup(): Promise<void> {
        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const childID = new OverscaledTileID(7, 0, 7, 16, 16);

        const mainInstances: any[] = [];
        const childInstances: any[] = [];

        for (let i = 0; i < SYMBOL_COUNT; i++) {
            // Pre-assign crossTileIDs as getCrossTileID would for features with IDs
            mainInstances.push(makeSymbolInstance(0, 0, '', i + 1));
            childInstances.push(makeSymbolInstance(0, 0, '', i + 1));
        }

        this._mainTile = makeTile(mainID, mainInstances);
        this._childTile = makeTile(childID, childInstances);
    }

    bench(): void {
        const index = new CrossTileSymbolIndex();
        index.addLayer(styleLayer, [this._mainTile], 0);
        index.addLayer(styleLayer, [this._childTile], 0);
    }
}

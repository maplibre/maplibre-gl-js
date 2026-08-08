import {bench} from 'vitest';
import {CrossTileSymbolIndex} from './cross_tile_symbol_index.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';

import type {Tile} from '../tile/tile.ts';
import type {StyleLayer} from '../style/style_layer.ts';

type TestSymbolInstance = {
    anchorX: number;
    anchorY: number;
    key: string;
    crossTileID: number;
};

const styleLayer = {id: 'test'} as StyleLayer;
const symbolCount = 3000;

function createTile(tileID: OverscaledTileID, symbolInstances: TestSymbolInstance[]): Tile {
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
    } as unknown as Tile;
}

function createInstances(): TestSymbolInstance[] {
    return Array.from({length: symbolCount}, (_, i) => ({
        anchorX: 0,
        anchorY: 0,
        key: '',
        crossTileID: i + 1
    }));
}

const mainTile = createTile(new OverscaledTileID(6, 0, 6, 8, 8), createInstances());
const childTile = createTile(new OverscaledTileID(7, 0, 7, 16, 16), createInstances());

bench('CrossTileSymbolIndex.addLayer', () => {
    const index = new CrossTileSymbolIndex();
    index.addLayer(styleLayer, [mainTile], 0);
    index.addLayer(styleLayer, [childTile], 0);
});

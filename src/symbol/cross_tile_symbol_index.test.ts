import {CrossTileSymbolIndex, KDBUSH_THRESHHOLD} from './cross_tile_symbol_index';
import {OverscaledTileID} from '../source/tile_id';
import {StyleLayer} from '../style/style_layer';

const styleLayer = {
    id: 'test'
} as StyleLayer;

const makeSymbolInstance = (x, y, key): any => {
    return {
        anchorX: x,
        anchorY: y,
        key
    };
};

const makeTile = (tileID, symbolInstances): any => {
    const bucket = {
        symbolInstances: {
            get(i) { return symbolInstances[i]; },
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

describe('CrossTileSymbolIndex.addLayer', () => {

    test('matches ids', () => {
        const index = new CrossTileSymbolIndex();

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = [
            makeSymbolInstance(1000, 1000, 'Detroit'),
            makeSymbolInstance(2000, 2000, 'Toronto')
        ];
        const mainTile = makeTile(mainID, mainInstances);

        index.addLayer(styleLayer, [mainTile], 0);
        // Assigned new IDs
        expect(mainInstances[0].crossTileID).toBe(1);
        expect(mainInstances[1].crossTileID).toBe(2);

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = [
            makeSymbolInstance(2000, 2000, 'Detroit'),
            makeSymbolInstance(2000, 2000, 'Windsor'),
            makeSymbolInstance(3000, 3000, 'Toronto'),
            makeSymbolInstance(4001, 4001, 'Toronto')
        ];
        const childTile = makeTile(childID, childInstances);

        index.addLayer(styleLayer, [mainTile, childTile], 0);
        // matched parent tile
        expect(childInstances[0].crossTileID).toBe(1);
        // does not match because of different key
        expect(childInstances[1].crossTileID).toBe(3);
        // does not match because of different location
        expect(childInstances[2].crossTileID).toBe(4);
        // matches with a slightly different location
        expect(childInstances[3].crossTileID).toBe(2);

        const parentID = new OverscaledTileID(5, 0, 5, 4, 4);
        const parentInstances = [
            makeSymbolInstance(500, 500, 'Detroit')
        ];
        const parentTile = makeTile(parentID, parentInstances);

        index.addLayer(styleLayer, [mainTile, childTile, parentTile], 0);
        // matched child tile
        expect(parentInstances[0].crossTileID).toBe(1);

        const grandchildID = new OverscaledTileID(8, 0, 8, 32, 32);
        const grandchildInstances = [
            makeSymbolInstance(4000, 4000, 'Detroit'),
            makeSymbolInstance(4000, 4000, 'Windsor')
        ];
        const grandchildTile = makeTile(grandchildID, grandchildInstances);

        index.addLayer(styleLayer, [mainTile], 0);
        index.addLayer(styleLayer, [mainTile, grandchildTile], 0);
        // Matches the symbol in `mainBucket`
        expect(grandchildInstances[0].crossTileID).toBe(1);
        // Does not match the previous value for Windsor because that tile was removed
        expect(grandchildInstances[1].crossTileID).toBe(5);

    });

    test('overwrites ids when re-adding', () => {
        const index = new CrossTileSymbolIndex();

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = [makeSymbolInstance(1000, 1000, 'Detroit')];
        const mainTile = makeTile(mainID, mainInstances);

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = [makeSymbolInstance(2000, 2000, 'Detroit')];
        const childTile = makeTile(childID, childInstances);

        // assigns a new id
        index.addLayer(styleLayer, [mainTile], 0);
        expect(mainInstances[0].crossTileID).toBe(1);

        // removes the tile
        index.addLayer(styleLayer, [], 0);

        // assigns a new id
        index.addLayer(styleLayer, [childTile], 0);
        expect(childInstances[0].crossTileID).toBe(2);

        // overwrites the old id to match the already-added tile
        index.addLayer(styleLayer, [mainTile, childTile], 0);
        expect(mainInstances[0].crossTileID).toBe(2);
        expect(childInstances[0].crossTileID).toBe(2);

    });

    test('does not duplicate ids within one zoom level', () => {
        const index = new CrossTileSymbolIndex();

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = [
            makeSymbolInstance(1000, 1000, ''), // A
            makeSymbolInstance(1000, 1000, '')  // B
        ];
        const mainTile = makeTile(mainID, mainInstances);

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = [
            makeSymbolInstance(2000, 2000, ''), // A'
            makeSymbolInstance(2000, 2000, ''), // B'
            makeSymbolInstance(2000, 2000, '')  // C'
        ];
        const childTile = makeTile(childID, childInstances);

        // assigns new ids
        index.addLayer(styleLayer, [mainTile], 0);
        expect(mainInstances[0].crossTileID).toBe(1);
        expect(mainInstances[1].crossTileID).toBe(2);

        const layerIndex = index.layerIndexes[styleLayer.id];
        expect(Object.keys(layerIndex.usedCrossTileIDs[6])).toEqual(['1', '2']);

        // copies parent ids without duplicate ids in this tile
        index.addLayer(styleLayer, [childTile], 0);
        expect(childInstances[0].crossTileID).toBe(1); // A' copies from A
        expect(childInstances[1].crossTileID).toBe(2); // B' copies from B
        expect(childInstances[2].crossTileID).toBe(3); // C' gets new ID

        // Updates per-zoom usedCrossTileIDs
        expect(Object.keys(layerIndex.usedCrossTileIDs[6])).toEqual([]);
        expect(Object.keys(layerIndex.usedCrossTileIDs[7])).toEqual(['1', '2', '3']);

    });

    test('does not regenerate ids for same zoom', () => {
        const index = new CrossTileSymbolIndex();

        const tileID = new OverscaledTileID(6, 0, 6, 8, 8);
        const firstInstances = [
            makeSymbolInstance(1000, 1000, ''), // A
            makeSymbolInstance(1000, 1000, '')  // B
        ];
        const firstTile = makeTile(tileID, firstInstances);

        const secondInstances = [
            makeSymbolInstance(1000, 1000, ''), // A'
            makeSymbolInstance(1000, 1000, ''), // B'
            makeSymbolInstance(1000, 1000, ''), // C'
        ];
        const secondTile = makeTile(tileID, secondInstances);

        // assigns new ids
        index.addLayer(styleLayer, [firstTile], 0);
        expect(firstInstances[0].crossTileID).toBe(1);
        expect(firstInstances[1].crossTileID).toBe(2);

        const layerIndex = index.layerIndexes[styleLayer.id];
        expect(Object.keys(layerIndex.usedCrossTileIDs[6])).toEqual(['1', '2']);

        // uses same ids when tile gets updated
        index.addLayer(styleLayer, [secondTile], 0);
        expect(secondInstances[0].crossTileID).toBe(1); // A' copies from A
        expect(secondInstances[1].crossTileID).toBe(2); // B' copies from B
        expect(secondInstances[2].crossTileID).toBe(3); // C' gets new ID

        expect(Object.keys(layerIndex.usedCrossTileIDs[6])).toEqual(['1', '2', '3']);

    });

    test('reuses indexes when longitude is wrapped', () => {
        const index = new CrossTileSymbolIndex();
        const longitude = 370;

        const tileID = new OverscaledTileID(6, 1, 6, 8, 8);
        const firstInstances = [
            makeSymbolInstance(1000, 1000, ''), // A
        ];
        const tile = makeTile(tileID, firstInstances);

        index.addLayer(styleLayer, [tile], longitude);
        expect(firstInstances[0].crossTileID).toBe(1); // A

        tile.tileID = tileID.wrapped();

        index.addLayer(styleLayer, [tile], longitude % 360);
        expect(firstInstances[0].crossTileID).toBe(1);

    });

    test('indexes data for findMatches perf', () => {
        const index = new CrossTileSymbolIndex();

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const childID = new OverscaledTileID(7, 0, 7, 16, 16);

        const mainInstances: any[] = [];
        const childInstances: any[] = [];

        for (let i = 0; i < KDBUSH_THRESHHOLD + 1; i++) {
            mainInstances.push(makeSymbolInstance(0, 0, ''));
            childInstances.push(makeSymbolInstance(0, 0, ''));
        }
        const mainTile = makeTile(mainID, mainInstances);
        const childTile = makeTile(childID, childInstances);
        index.addLayer(styleLayer, [mainTile], 0);
        index.addLayer(styleLayer, [childTile], 0);

        // check that we matched the parent tile
        expect(childInstances[0].crossTileID).toBe(1);

    });
});

describe('CrossTileSymbolIndex.pruneUnusedLayers', () => {
    const index = new CrossTileSymbolIndex();

    const tileID = new OverscaledTileID(6, 0, 6, 8, 8);
    const instances = [
        makeSymbolInstance(1000, 1000, ''), // A
        makeSymbolInstance(1000, 1000, '')  // B
    ];
    const tile = makeTile(tileID, instances);

    // assigns new ids
    index.addLayer(styleLayer, [tile], 0);
    expect(instances[0].crossTileID).toBe(1);
    expect(instances[1].crossTileID).toBe(2);
    expect(index.layerIndexes[styleLayer.id]).toBeTruthy();

    // remove styleLayer
    index.pruneUnusedLayers([]);
    expect(index.layerIndexes[styleLayer.id]).toBeFalsy();

});

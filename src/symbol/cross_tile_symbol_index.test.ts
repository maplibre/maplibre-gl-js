import {describe, test, expect} from 'vitest';
import {CrossTileSymbolIndex, KDBUSH_THRESHHOLD} from './cross_tile_symbol_index';
import {OverscaledTileID} from '../tile/tile_id';
import {type StyleLayer} from '../style/style_layer';

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

});

describe('CrossTileSymbolIndex.addLayer with a scale that causes indexing', () => {
    test('matches ids', () => {
        const index = new CrossTileSymbolIndex();
        const INSTANCE_COUNT = KDBUSH_THRESHHOLD + 1;

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(1000, 1000, 'Detroit'));
        mainInstances.push(makeSymbolInstance(2000, 2000, 'Toronto'));
        const mainTile = makeTile(mainID, mainInstances);

        index.addLayer(styleLayer, [mainTile], 0);
        // Assigned new IDs
        for (let i = 1; i <= INSTANCE_COUNT + 1; i++) {
            expect(mainInstances.find(j => j.crossTileID === i)).not.toBeUndefined();
        }

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(2000, 2000, 'Detroit'));
        childInstances.push(makeSymbolInstance(2000, 2000, 'Windsor'));
        childInstances.push(makeSymbolInstance(3000, 3000, 'Toronto'));
        childInstances.push(makeSymbolInstance(4001, 4001, 'Toronto'));
        const childTile = makeTile(childID, childInstances);

        index.addLayer(styleLayer, [mainTile, childTile], 0);
        // matched parent tile for all Detroit
        const detroitChildren = childInstances.filter(i => i.key === 'Detroit');
        for (let i = 1; i <= INSTANCE_COUNT; i++) {
            expect(detroitChildren.find(j => j.crossTileID === i)).not.toBeUndefined();
        }

        // does not match Windsor because of different key
        const windsorInstance = childInstances.find(i => i.key === 'Windsor');
        expect(windsorInstance.crossTileID).toEqual(131);

        // does not match Toronto @ 3000 because of different location
        const toronto3000Instance = childInstances.find(i => i.key === 'Toronto' && i.anchorX === 3000);
        expect(toronto3000Instance.crossTileID).toEqual(132);

        // matches Toronto @ 4001 even though it has a slightly updated location
        const toronto4001Instance = childInstances.find(i => i.key === 'Toronto' && i.anchorX === 4001);
        expect(toronto4001Instance.crossTileID).toBeLessThanOrEqual(INSTANCE_COUNT + 1);

        const parentID = new OverscaledTileID(5, 0, 5, 4, 4);
        const parentInstances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(500, 500, 'Detroit'));
        const parentTile = makeTile(parentID, parentInstances);

        index.addLayer(styleLayer, [mainTile, childTile, parentTile], 0);
        // matched Detroit children tiles from parent
        for (let i = 1; i < INSTANCE_COUNT; i++) {
            expect(parentInstances.find(j => j.crossTileID === i)).not.toBeUndefined();
        }

        const grandchildID = new OverscaledTileID(8, 0, 8, 32, 32);
        const grandchildInstances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(4000, 4000, 'Detroit'));
        grandchildInstances.push(makeSymbolInstance(4000, 4000, 'Windsor'));
        const grandchildTile = makeTile(grandchildID, grandchildInstances);

        index.addLayer(styleLayer, [mainTile], 0);
        index.addLayer(styleLayer, [mainTile, grandchildTile], 0);
        // matches Detroit grandchildren with mainBucket
        const detroitGrandchildren = grandchildInstances.filter(i => i.key === 'Detroit');
        for (let i = 1; i <= INSTANCE_COUNT; i++) {
            expect(detroitGrandchildren.find(j => j.crossTileID === i)).not.toBeUndefined();
        }

        // Does not match the Windsor value because that was removed
        const windsorGrandchild = grandchildInstances.find(i => i.key === 'Windsor');
        expect(windsorGrandchild.crossTileID).toEqual(133);
    });

    test('overwrites ids when re-adding', () => {
        const index = new CrossTileSymbolIndex();
        const INSTANCE_COUNT = KDBUSH_THRESHHOLD + 1;

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(1000, 1000, 'Detroit'));
        const mainTile = makeTile(mainID, mainInstances);

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(2000, 2000, 'Detroit'));
        const childTile = makeTile(childID, childInstances);

        // Assigns new ids 1 -> INSTANCE_COUNT
        index.addLayer(styleLayer, [mainTile], 0);
        expect(Math.max(...mainInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT);

        // Removes the layer
        index.addLayer(styleLayer, [], 0);

        // Assigns new ids INSTANCE_COUNT + 1 -> 2 * INSTANCE_COUNT
        index.addLayer(styleLayer, [childTile], 0);
        expect(Math.min(...childInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT + 1);
        expect(Math.max(...childInstances.map(i => i.crossTileID))).toBe(2 * INSTANCE_COUNT);

        // Expect all to have a crossTileID
        expect(mainInstances.some(i => i.crossTileID === 0)).toBeFalsy();
        expect(childInstances.some(i => i.crossTileID === 0)).toBeFalsy();

        // Overwrites the old id to match the already-added tile
        index.addLayer(styleLayer, [mainTile, childTile], 0);
        expect(Math.min(...mainInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT + 1);
        expect(Math.max(...mainInstances.map(i => i.crossTileID))).toBe(2 * INSTANCE_COUNT);
        expect(Math.min(...childInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT + 1);
        expect(Math.max(...childInstances.map(i => i.crossTileID))).toBe(2 * INSTANCE_COUNT);
    });

    test('does not duplicate ids within one zoom level', () => {
        const index = new CrossTileSymbolIndex();
        const INSTANCE_COUNT = KDBUSH_THRESHHOLD + 1;

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const mainInstances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(1000, 1000, ''));
        const mainTile = makeTile(mainID, mainInstances);

        const childID = new OverscaledTileID(7, 0, 7, 16, 16);
        const childInstances = Array.from({length: INSTANCE_COUNT + 1}, () => makeSymbolInstance(2000, 2000, ''));
        const childTile = makeTile(childID, childInstances);

        // Assigns new ids 1 -> INSTANCE_COUNT
        index.addLayer(styleLayer, [mainTile], 0);
        expect(mainInstances.some(i => i.crossTileID === 0)).toBeFalsy();
        expect(Math.min(...mainInstances.map(i => i.crossTileID))).toBe(1);
        expect(Math.max(...mainInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT);

        const layerIndex = index.layerIndexes[styleLayer.id];
        expect(Object.keys(layerIndex.usedCrossTileIDs[6]).length).toEqual(INSTANCE_COUNT);
        for (let i = 1; i <= INSTANCE_COUNT; i++) {
            expect(layerIndex.usedCrossTileIDs[6][String(i)]).not.toBeUndefined();
        }

        // copies parent ids without duplicate ids in this tile
        index.addLayer(styleLayer, [childTile], 0);
        for (let i = 1; i <= INSTANCE_COUNT; i++) {
            // 1 -> INSTANCE_COUNT are copied
            expect(childInstances.find(j => j.crossTileID === i)).not.toBeUndefined();
        }
        // We have one new key generated for INSTANCE_COUNT + 1
        expect(Math.max(...childInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT + 1);

        // Updates per-zoom usedCrossTileIDs
        expect(Object.keys(layerIndex.usedCrossTileIDs[6])).toEqual([]);
        for (let i = 1; i <= INSTANCE_COUNT + 1; i++) {
            expect(layerIndex.usedCrossTileIDs[7][String(i)]).not.toBeUndefined();
        }
    });

    test('does not regenerate ids for same zoom', () => {
        const index = new CrossTileSymbolIndex();
        const INSTANCE_COUNT = KDBUSH_THRESHHOLD + 1;

        const tileID = new OverscaledTileID(6, 0, 6, 8, 8);
        const firstInstances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(1000, 1000, ''));
        const firstTile = makeTile(tileID, firstInstances);

        const secondInstances = Array.from({length: INSTANCE_COUNT + 1}, () => makeSymbolInstance(1000, 1000, ''));
        const secondTile = makeTile(tileID, secondInstances);

        // Assigns new ids 1 -> INSTANCE_COUNT
        index.addLayer(styleLayer, [firstTile], 0);
        expect(firstInstances.some(i => i.crossTileID === 0)).toBeFalsy();
        expect(Math.min(...firstInstances.map(i => i.crossTileID))).toBe(1);
        expect(Math.max(...firstInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT);

        const layerIndex = index.layerIndexes[styleLayer.id];
        for (let i = 1; i <= INSTANCE_COUNT; i++) {
            expect(layerIndex.usedCrossTileIDs[6][String(i)]).not.toBeUndefined();
        }

        // Uses same ids when tile gets updated
        index.addLayer(styleLayer, [secondTile], 0);
        for (let i = 1; i <= INSTANCE_COUNT; i++) {
            // 1 -> INSTANCE_COUNT are copied
            expect(secondInstances.find(j => j.crossTileID === i)).not.toBeUndefined();
        }
        // We have one new key generated for INSTANCE_COUNT + 1
        expect(Math.max(...secondInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT + 1);

        // Updates usedCrossTileIDs
        for (let i = 1; i <= INSTANCE_COUNT + 1; i++) {
            expect(layerIndex.usedCrossTileIDs[6][String(i)]).not.toBeUndefined();
        }
    });

    test('reuses indexes when longitude is wrapped', () => {
        const index = new CrossTileSymbolIndex();
        const INSTANCE_COUNT = KDBUSH_THRESHHOLD + 1;
        const longitude = 370;

        const tileID = new OverscaledTileID(6, 1, 6, 8, 8);
        const instances = Array.from({length: INSTANCE_COUNT}, () => makeSymbolInstance(1000, 1000, ''));
        const tile = makeTile(tileID, instances);

        index.addLayer(styleLayer, [tile], longitude);
        for (let i = 1; i <= INSTANCE_COUNT; i++) {
            expect(instances.find(j => j.crossTileID === i)).not.toBeUndefined();
        }

        tile.tileID = tileID.wrapped();

        index.addLayer(styleLayer, [tile], longitude % 360);
        for (let i = 1; i <= INSTANCE_COUNT; i++) {
            expect(instances.find(j => j.crossTileID === i)).not.toBeUndefined();
        }
    });

    test('indexes data for findMatches perf', () => {
        const index = new CrossTileSymbolIndex();

        const mainID = new OverscaledTileID(6, 0, 6, 8, 8);
        const childID = new OverscaledTileID(7, 0, 7, 16, 16);

        const mainInstances: any[] = [];
        const childInstances: any[] = [];

        const INSTANCE_COUNT = KDBUSH_THRESHHOLD + 1;
        for (let i = 0; i < INSTANCE_COUNT; i++) {
            mainInstances.push(makeSymbolInstance(0, 0, ''));
            childInstances.push(makeSymbolInstance(0, 0, ''));
        }
        const mainTile = makeTile(mainID, mainInstances);
        const childTile = makeTile(childID, childInstances);
        index.addLayer(styleLayer, [mainTile], 0);
        index.addLayer(styleLayer, [childTile], 0);

        // all child instances matched a crossTileID from the parent, otherwise
        // we would have generated a new crossTileID, and the number would
        // exceed INSTANCE_COUNT
        expect(childInstances.every(i => i.crossTileID <= INSTANCE_COUNT)).toBeTruthy();
        expect(Math.max(...childInstances.map(i => i.crossTileID))).toBe(INSTANCE_COUNT);
    });
});

test('CrossTileSymbolIndex.pruneUnusedLayers', () => {

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


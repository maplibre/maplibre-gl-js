import {describe, test, expect} from 'vitest';
import {FeaturePositionMap} from './feature_position_map.ts';
import {serialize, deserialize} from '../util/web_worker_transfer.ts';

describe('FeaturePositionMap', () => {
    test('Can be queried after serialization/deserialization', () => {
        const featureMap = new FeaturePositionMap();
        featureMap.add(7, 1, 0, 1);
        featureMap.add(3, 2, 1, 2);
        featureMap.add(7, 3, 2, 3);
        featureMap.add(4, 4, 3, 4);
        featureMap.add(2, 5, 4, 5);
        featureMap.add(7, 6, 5, 7);

        const featureMap2 = deserialize(serialize(featureMap, [])) as FeaturePositionMap;

        const compareIndex = (a, b) => a.index - b.index;

        expect(featureMap2.getPositions(7).sort(compareIndex)).toEqual([
            {index: 1, start: 0, end: 1},
            {index: 3, start: 2, end: 3},
            {index: 6, start: 5, end: 7}
        ].sort(compareIndex));
    });

    test('Can be queried after serializing ids listed twice in ascending order', () => {
        const featureMap = new FeaturePositionMap();
        featureMap.add(0, 0, 0, 1);
        featureMap.add(1, 1, 1, 2);
        featureMap.add(2, 2, 2, 3);
        featureMap.add(3, 3, 3, 4);
        featureMap.add(4, 4, 4, 5);
        featureMap.add(5, 5, 5, 6);
        featureMap.add(6, 6, 6, 7);
        featureMap.add(7, 7, 7, 8);
        featureMap.add(8, 8, 8, 9);

        featureMap.add(0, 9, 9, 10);
        featureMap.add(1, 10, 10, 11);
        featureMap.add(2, 11, 11, 12);
        featureMap.add(3, 12, 12, 13);
        featureMap.add(4, 13, 13, 14);
        featureMap.add(5, 14, 14, 15);
        featureMap.add(6, 15, 15, 16);
        featureMap.add(7, 16, 16, 17);
        featureMap.add(8, 17, 17, 18);

        const featureMap2 = deserialize(serialize(featureMap, [])) as FeaturePositionMap;

        const compareIndex = (a, b) => a.index - b.index;

        expect(featureMap2.getPositions(0).sort(compareIndex)).toEqual([
            {index: 0, start: 0, end: 1},
            {index: 9, start: 9, end: 10}
        ]);
        expect(featureMap2.getPositions(4).sort(compareIndex)).toEqual([
            {index: 4, start: 4, end: 5},
            {index: 13, start: 13, end: 14}
        ]);
        expect(featureMap2.getPositions(8).sort(compareIndex)).toEqual([
            {index: 8, start: 8, end: 9},
            {index: 17, start: 17, end: 18}
        ]);
    });

    test('Can not be queried before serialization/deserialization', () => {
        const featureMap = new FeaturePositionMap();
        featureMap.add(0, 1, 2, 3);

        expect(() => {
            featureMap.getPositions(0);
        }).toThrow('Trying to get index, but feature positions are not indexed');
    });
});

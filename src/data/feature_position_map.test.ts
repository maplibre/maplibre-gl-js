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
        for (let i = 0; i < 2000; i++) {
            featureMap.add(i % 1000, i, i, i + 1);
        }

        const featureMap2 = deserialize(serialize(featureMap, [])) as FeaturePositionMap;

        for (let id = 0; id < 1000; id++) {
            const indices = featureMap2.getPositions(id).map(position => position.index);
            expect(indices.sort((a, b) => a - b)).toEqual([id, id + 1000]);
        }
    });

    test('Can not be queried before serialization/deserialization', () => {
        const featureMap = new FeaturePositionMap();
        featureMap.add(0, 1, 2, 3);

        expect(() => {
            featureMap.getPositions(0);
        }).toThrow('Trying to get index, but feature positions are not indexed');
    });
});

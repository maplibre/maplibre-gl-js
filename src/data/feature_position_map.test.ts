import '../../stub_loader';

import FeatureMap from '../data/feature_position_map';
import {serialize, deserialize} from '../util/web_worker_transfer';

describe('FeaturePositionMap', done => {

    test('Can be queried after serialization/deserialization', done => {
        const featureMap = new FeatureMap();
        featureMap.add(7, 1, 0, 1);
        featureMap.add(3, 2, 1, 2);
        featureMap.add(7, 3, 2, 3);
        featureMap.add(4, 4, 3, 4);
        featureMap.add(2, 5, 4, 5);
        featureMap.add(7, 6, 5, 7);

        const featureMap2 = deserialize(serialize(featureMap, []));

        const compareIndex = (a, b) => a.index - b.index;

        expect(featureMap2.getPositions(7).sort(compareIndex)).toEqual([
            {index: 1, start: 0, end: 1},
            {index: 3, start: 2, end: 3},
            {index: 6, start: 5, end: 7}
        ].sort(compareIndex));

        done();
    });

    test('Can not be queried before serialization/deserialization', done => {
        const featureMap = new FeatureMap();
        featureMap.add(0, 1, 2, 3);

        expect(() => {
            featureMap.getPositions(0);
        }).toThrow();

        done();
    });

    done();
});

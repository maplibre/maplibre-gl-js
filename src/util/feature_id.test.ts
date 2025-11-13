import {type VectorTileFeature} from '@mapbox/vector-tile';
import {describe, expect, test} from 'vitest';
import {getFeatureId} from './feature_id';

describe('getFeatureId', () => {
    test('uses cluster_id when cluster is true and id is undefined', () => {
        const feature = {
            properties: {
                cluster: true,
                cluster_id: '123',
                promoteId: 'someProperty',
                someProperty: undefined
            },
            geometry: {
                type: 'Point',
                coordinates: [0, 0]
            },
            extent: 4096,
            type: 1,
            loadGeometry: () => [],
            toGeoJSON: () => ({})
        } as unknown as VectorTileFeature;

        expect(getFeatureId(feature, 'sourceLayer')).toBe(123); // cluster_id converted to number
    });
});

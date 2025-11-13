import {type VectorTileFeature} from '@mapbox/vector-tile';
import {describe, expect, test} from 'vitest';
import {getFeatureId} from './feature_id';

describe('getFeatureId', () => {
    test('returns feature.id', () => {
        const feature = {id: 42, properties: {}} as unknown as VectorTileFeature;
        expect(getFeatureId(feature, undefined)).toBe(42);
    });

    test('returns property when promoteId is string', () => {
        const feature = {id: 1, properties: {customId: 99}} as unknown as VectorTileFeature;
        expect(getFeatureId(feature, 'customId')).toBe(99);
    });

    test('returns property when promoteId is object', () => {
        const feature = {id: 1, properties: {customId: 99}} as unknown as VectorTileFeature;
        expect(getFeatureId(feature, {layer1: 'customId'}, 'layer1')).toBe(99);
    });

    test('converts boolean to number', () => {
        const feature = {properties: {flag: true}} as unknown as VectorTileFeature;
        expect(getFeatureId(feature, 'flag')).toBe(1);
    });

    test('returns cluster_id when promoted id is undefined and cluster is true', () => {
        const feature = {
            properties: {cluster: true, cluster_id: '123', customId: undefined}
        } as unknown as VectorTileFeature;
        expect(getFeatureId(feature, 'customId')).toBe(123);
    });
});

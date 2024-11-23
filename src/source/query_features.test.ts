import {describe, test, expect} from 'vitest';
import {
    queryRenderedFeatures,
    querySourceFeatures
} from './query_features';
import {SourceCache} from './source_cache';
import type Point from '@mapbox/point-geometry';
import {MercatorTransform} from '../geo/projection/mercator_transform';

describe('QueryFeatures#rendered', () => {
    test('returns empty object if source returns no tiles', () => {
        const mockSourceCache = {tilesIn () { return []; }} as any as SourceCache;
        const transform = new MercatorTransform();
        const result = queryRenderedFeatures(mockSourceCache, {}, undefined, [] as Point[], undefined, transform);
        expect(result).toEqual({});
    });

});

describe('QueryFeatures#source', () => {
    test('returns empty result when source has no features', () => {
        const sourceCache = new SourceCache('test', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        }, {
            getActor() {}
        } as any);
        const result = querySourceFeatures(sourceCache, {});
        expect(result).toEqual([]);
    });

});

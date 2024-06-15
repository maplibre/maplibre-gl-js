import {
    queryRenderedFeatures,
    querySourceFeatures
} from './query_features.ts';
import {SourceCache} from './source_cache.ts';
import {Transform} from '../geo/transform.ts';
import Point from '@mapbox/point-geometry';

describe('QueryFeatures#rendered', () => {
    test('returns empty object if source returns no tiles', () => {
        const mockSourceCache = {tilesIn () { return []; }} as any as SourceCache;
        const transform = new Transform();
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

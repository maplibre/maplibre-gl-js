import {
    queryRenderedFeatures,
    querySourceFeatures
} from './query_features';
import {SourceCache} from './source_cache';
import {Transform} from '../geo/transform';
import Point from '@mapbox/point-geometry';
import {Dispatcher} from '../util/dispatcher';

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
            getActor() {
                return {
                    send(type, params, callback) { return callback(); }
                };
            }
        } as any as Dispatcher);
        const result = querySourceFeatures(sourceCache, {});
        expect(result).toEqual([]);
    });

});

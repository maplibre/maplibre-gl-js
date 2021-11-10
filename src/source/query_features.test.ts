import '../../stub_loader';
import {
    queryRenderedFeatures,
    querySourceFeatures
} from '../source/query_features.js';
import SourceCache from '../source/source_cache.js';
import Transform from '../geo/transform.js';

describe('QueryFeatures#rendered', () => {
    test('returns empty object if source returns no tiles', () => {
        const mockSourceCache = {tilesIn () { return []; }};
        const transform = new Transform();
        const result = queryRenderedFeatures(mockSourceCache, {}, undefined, {}, undefined, transform);
        expect(result).toEqual([]);
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
        });
        const result = querySourceFeatures(sourceCache, {});
        expect(result).toEqual([]);
    });

});

import {describe, test, expect} from 'vitest';
import {
    queryRenderedFeatures,
    querySourceFeatures
} from './query_features';
import {VectorTileManager} from '../tile/vector_tile_manager';
import type Point from '@mapbox/point-geometry';
import {MercatorTransform} from '../geo/projection/mercator_transform';

describe('QueryFeatures.rendered', () => {
    test('returns empty object if source returns no tiles', () => {
        const mockTileManager = {tilesIn () { return []; }} as any as VectorTileManager;
        const transform = new MercatorTransform();
        const result = queryRenderedFeatures(mockTileManager, {}, undefined, [] as Point[], undefined, transform, undefined);
        expect(result).toEqual({});
    });

});

describe('QueryFeatures.source', () => {
    test('returns empty result when source has no features', () => {
        const tileManager = new VectorTileManager('test', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        }, {
            getActor() {}
        } as any);
        const result = querySourceFeatures(tileManager, {});
        expect(result).toEqual([]);
    });

});

import {describe, test, expect} from 'vitest';
import {
    queryRenderedFeatures,
    querySourceFeatures
} from './query_features';
import {createTileManager} from '../tile/tile_manager';
import type Point from '@mapbox/point-geometry';
import {MercatorTransform} from '../geo/projection/mercator_transform';

describe('QueryFeatures.rendered', () => {
    test('returns empty object if source returns no tiles', () => {
        const mockTileManager = createTileManager('test', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        }, {
            getActor() {}
        } as any, 'vector');
        const transform = new MercatorTransform();
        const result = queryRenderedFeatures(mockTileManager, {}, undefined, [] as Point[], undefined, transform, undefined);
        expect(result).toEqual({});
    });

});

describe('QueryFeatures.source', () => {
    test('returns empty result when source has no features', () => {
        const tileManager = createTileManager('test', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        }, {
            getActor() {}
        } as any, 'vector');
        const result = querySourceFeatures(tileManager, {});
        expect(result).toEqual([]);
    });

});

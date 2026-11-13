import {describe, test, expect} from 'vitest';
import {
    queryRenderedFeatures,
    querySourceFeatures
} from './query_features.ts';
import {TileManager} from '../tile/tile_manager.ts';
import {mercatorWorldCoordinateHelper} from '../geo/mercator_coordinate.ts';
import {createTestCamera} from '../util/test/util.ts';

import type Point from '@mapbox/point-geometry';

describe('QueryFeatures.rendered', () => {
    test('returns empty object if source returns no tiles', () => {
        const mockTileManager = {tilesIn () { return []; }} as any as TileManager;
        const {projectedCamera, context} = createTestCamera();
        const result = queryRenderedFeatures(mockTileManager, {}, undefined, [] as Point[], undefined, projectedCamera, context.worldCoordinateHelper, undefined);
        expect(result).toEqual({});
    });

});

describe('QueryFeatures.source', () => {
    test('returns empty result when source has no features', () => {
        const tileManager = new TileManager('test', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        }, {
            getActor() {}
        } as any);
        const result = querySourceFeatures(tileManager, {worldCoordinateHelper: mercatorWorldCoordinateHelper});
        expect(result).toEqual([]);
    });

});

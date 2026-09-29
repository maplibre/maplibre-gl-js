import {test, expect} from 'vitest';
import {restoreJSONEncodedProperties} from './vectortile_to_geojson.ts';

import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

test('restoreJSONEncodedProperties restores original types of JSON-encoded properties', () => {
    const feature = {
        properties: {
            attributeIds: '__$json__:[1,37]',
            name: 'plain string',
            count: 5,
            flag: true
        }
    } as unknown as VectorTileFeatureLike;

    restoreJSONEncodedProperties(feature);

    expect(feature.properties).toEqual({
        attributeIds: [1, 37],
        name: 'plain string',
        count: 5,
        flag: true
    });
});

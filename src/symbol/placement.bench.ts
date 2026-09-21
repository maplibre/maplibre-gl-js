import {test} from 'vitest';
import {Placement} from './placement.ts';
import {CrossTileSymbolIndex} from './cross_tile_symbol_index.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {CollisionBoxArray} from '../data/array_types.g.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createSymbolTile} from '../../test/unit/lib/create_symbol_layer.ts';
import {getFeaturesFromLayer, loadVectorTile} from '../../test/unit/lib/tile.ts';

import type {SymbolBucket} from '../data/bucket/symbol_bucket.ts';

const bucketCount = 40;
const collisionBoxArray = new CollisionBoxArray();
const features = getFeaturesFromLayer(loadVectorTile().layers.place_label);

const tiles = Array.from({length: bucketCount}, (_, i) => createSymbolTile(
    new OverscaledTileID(6, 0, 6, 18 + (i % 8), 23 + Math.floor(i / 8)),
    features, collisionBoxArray, {'text-allow-overlap': true}));

const layer = (tiles[0].buckets.test as SymbolBucket).layers[0];
new CrossTileSymbolIndex().addLayer(layer, tiles, 0);

const transform = new MercatorTransform();
transform.resize(1280, 900);
const placement = new Placement(transform, undefined, 0, true);
placement.updateLayerOpacities(layer, tiles);

test('Placement.updateLayerOpacities', async ({bench}) => {
    await bench.compare(
        bench('buffers reused', () => {
            placement.updateLayerOpacities(layer, tiles);
        }),
        bench('buffers rewritten', () => {
            placement.lastOpacityInputs = new WeakMap();
            placement.updateLayerOpacities(layer, tiles);
        })
    );
});

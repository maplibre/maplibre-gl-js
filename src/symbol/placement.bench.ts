import {test} from 'vitest';
import {Placement, type BucketPart} from './placement.ts';
import {CrossTileSymbolIndex} from './cross_tile_symbol_index.ts';
import {CollisionBoxArray} from '../data/array_types.g.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createSymbolTile} from '../../test/unit/lib/create_symbol_layer.ts';
import {getFeaturesFromLayer, loadVectorTile} from '../../test/unit/lib/tile.ts';
import {createTestCamera} from '../util/test/util.ts';

import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {ProjectedCamera} from '../camera/projected_camera.ts';
import type {SymbolBucket} from '../data/bucket/symbol_bucket.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {Tile} from '../tile/tile.ts';

const bucketCount = 40;
const collisionBoxArray = new CollisionBoxArray();
const features = getFeaturesFromLayer(loadVectorTile().layers.place_label);

const tiles = Array.from({length: bucketCount}, (_, i) => createSymbolTile(
    new OverscaledTileID(6, 0, 6, 18 + (i % 8), 23 + Math.floor(i / 8)),
    features, collisionBoxArray, {'text-allow-overlap': true}));

const layer = (tiles[0].buckets.test as SymbolBucket).layers[0];
new CrossTileSymbolIndex().addLayer(layer, tiles, 0);

const placement = new Placement(createTestCamera({width: 1280, height: 900}).projectedCamera, undefined, 0, true);
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

test('Placement.placeLayerBucketPart', async ({bench}) => {
    // centred on the 8 by 5 tiles at their own zoom, so that labels land on screen at their real size and collide
    const camera = createTestCamera({width: 1280, height: 900, zoom: 6, center: [-56.25, 34.3]}).projectedCamera;
    const collisions = createLayerTiles({});
    const allowOverlap = createLayerTiles({'text-allow-overlap': true});
    const variableAnchors = createLayerTiles({'text-variable-anchor': ['top', 'bottom', 'left', 'right']});

    await bench.compare(
        bench('collisions', () => {
            placeAll(camera, collisions);
        }),
        bench('allow overlap', () => {
            placeAll(camera, allowOverlap);
        }),
        bench('variable anchors', () => {
            placeAll(camera, variableAnchors);
        })
    );
});

/** The benchmark's tiles with their place labels laid out with `layout`, indexed across tiles and ready to place. */
function createLayerTiles(layout: SymbolLayerSpecification['layout']): {layer: StyleLayer; tiles: Tile[]} {
    const tiles = Array.from({length: bucketCount}, (_, i) => createSymbolTile(
        new OverscaledTileID(6, 0, 6, 18 + (i % 8), 23 + Math.floor(i / 8)),
        features, collisionBoxArray, layout));
    const layer = (tiles[0].buckets.test as SymbolBucket).layers[0];
    new CrossTileSymbolIndex().addLayer(layer, tiles, 0);
    return {layer, tiles};
}

/** Places every label of the tiles from scratch, the way a full placement does. */
function placeAll(camera: ProjectedCamera, {layer, tiles}: {layer: StyleLayer; tiles: Tile[]}): Placement {
    const placement = new Placement(camera, undefined, 0, true);
    const parts: BucketPart[] = [];
    for (const tile of tiles) placement.getBucketParts(parts, layer, tile, false);
    const seenCrossTileIDs = {};
    for (const part of parts) placement.placeLayerBucketPart(part, seenCrossTileIDs, false);
    return placement;
}

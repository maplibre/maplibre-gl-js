import {test} from 'vitest';
import {Placement} from './placement.ts';
import {CrossTileSymbolIndex} from './cross_tile_symbol_index.ts';
import {performSymbolLayout} from './symbol_layout.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {CollisionBoxArray} from '../data/array_types.g.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {Tile} from '../tile/tile.ts';
import {FeatureIndex} from '../data/feature_index.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';
import {createGlyphMap, createSymbolBucket} from '../../test/unit/lib/create_symbol_layer.ts';
import {createPopulateOptions, getFeaturesFromLayer, loadVectorTile} from '../../test/unit/lib/tile.ts';

const bucketCount = 40;
const collisionBoxArray = new CollisionBoxArray();
const glyphMap = createGlyphMap();
const features = getFeaturesFromLayer(loadVectorTile().layers.place_label);

const tiles = Array.from({length: bucketCount}, (_, i) => {
    const bucket = createSymbolBucket('test', 'Test', 'abcde', collisionBoxArray, {'text-allow-overlap': true});
    bucket.populate(features, createPopulateOptions([]), undefined);
    performSymbolLayout({
        bucket,
        glyphMap,
        glyphPositions: glyphMap,
        subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
    } as any);

    const tileID = new OverscaledTileID(6, 0, 6, 18 + (i % 8), 23 + Math.floor(i / 8));
    const tile = new Tile(tileID, 512);
    tile.latestFeatureIndex = new FeatureIndex(tileID);
    tile.buckets = {test: bucket};
    tile.collisionBoxArray = collisionBoxArray;
    return tile;
});

const layer = (tiles[0].buckets.test as any).layers[0];
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
            placement.lastOpacityInputs.clear();
            placement.updateLayerOpacities(layer, tiles);
        })
    );
});

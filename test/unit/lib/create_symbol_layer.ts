import {SymbolBucket} from '../../../src/data/bucket/symbol_bucket.ts';
import {SymbolStyleLayer} from '../../../src/style/style_layer/symbol_style_layer.ts';
import {Tile} from '../../../src/tile/tile.ts';
import {FeatureIndex} from '../../../src/data/feature_index.ts';
import {performSymbolLayout} from '../../../src/symbol/symbol_layout.ts';
import {SubdivisionGranularitySetting} from '../../../src/render/subdivision_granularity_settings.ts';
import {createPopulateOptions} from './tile.ts';
import {featureFilter, type LayerSpecification, type SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import glyphs from '../assets/fontstack-glyphs.json' with {type: 'json'};

import type {EvaluationParameters} from '../../../src/style/evaluation_parameters.ts';
import type {BucketParameters, IndexedFeature} from '../../../src/data/bucket.ts';
import type {CollisionBoxArray} from '../../../src/data/array_types.g.ts';
import type {GlyphMap} from '../../../src/style/style_glyph.ts';
import type {OverscaledTileID} from '../../../src/tile/tile_id.ts';

/** The `Test` fontstack fixture, keyed by grapheme cluster and doubling as the atlas positions. */
export function createGlyphMap(): GlyphMap {
    return {Test: {default: Object.fromEntries(
        Object.entries(glyphs).map(([codePoint, glyph]) => [String.fromCodePoint(Number(codePoint)), glyph])
    )}} as unknown as GlyphMap;
}

export function createSymbolStyleLayer(layerId: string, font: string, text: string, extraLayout?: SymbolLayerSpecification['layout']): SymbolStyleLayer {
    const layer = new SymbolStyleLayer({
        id: layerId,
        type: 'symbol',
        layout: {'text-font': [font], 'text-field': text, ...extraLayout},
        filter: featureFilter(undefined, 'filter')
    } as any as LayerSpecification, {});
    layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
    return layer;
}

export function createSymbolBucket(layerId: string, font: string, text: string,  collisionBoxArray: CollisionBoxArray, extraLayout?: SymbolLayerSpecification['layout']): SymbolBucket {
    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray,
        layers: [createSymbolStyleLayer(layerId, font, text, extraLayout)]
    } as BucketParameters<SymbolStyleLayer>);
}

/** A tile whose `test` bucket holds `features` laid out with the `Test` fontstack, ready for cross tile indexing and placement. */
export function createSymbolTile(tileID: OverscaledTileID, features: IndexedFeature[], collisionBoxArray: CollisionBoxArray, extraLayout?: SymbolLayerSpecification['layout']): Tile {
    const bucket = createSymbolBucket('test', 'Test', 'abcde', collisionBoxArray, extraLayout);
    bucket.populate(features, createPopulateOptions([]), undefined);
    const glyphMap = createGlyphMap();
    performSymbolLayout({
        bucket,
        glyphMap,
        glyphPositions: glyphMap,
        subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
    } as any);

    const tile = new Tile(tileID, 512);
    tile.latestFeatureIndex = new FeatureIndex(tileID);
    tile.buckets = {test: bucket};
    tile.collisionBoxArray = collisionBoxArray;
    return tile;
}

export function createSymbolIconBucket(layerId: string, iconProperty: string, collisionBoxArray: CollisionBoxArray): SymbolBucket {
    const layer = new SymbolStyleLayer({
        id: layerId,
        type: 'symbol',
        layout: {'icon-image': ['get', iconProperty]},
        filter: featureFilter(undefined, 'filter')
    } as any as LayerSpecification, {});
    layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray,
        layers: [layer]
    } as BucketParameters<SymbolStyleLayer>);
}

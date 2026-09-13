import {SymbolBucket} from '../../../src/data/bucket/symbol_bucket.ts';
import {SymbolStyleLayer} from '../../../src/style/style_layer/symbol_style_layer.ts';
import {featureFilter, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import glyphs from '../assets/fontstack-glyphs.json' with {type: 'json'};

import type {EvaluationParameters} from '../../../src/style/evaluation_parameters.ts';
import type {BucketParameters} from '../../../src/data/bucket.ts';
import type {CollisionBoxArray} from '../../../src/data/array_types.g.ts';
import type {GlyphMap} from '../../../src/style/style_glyph.ts';

/** The `Test` fontstack fixture, keyed by grapheme cluster and doubling as the atlas positions. */
export function createGlyphMap(): GlyphMap {
    return {Test: {default: Object.fromEntries(
        Object.entries(glyphs).map(([codePoint, glyph]) => [String.fromCodePoint(Number(codePoint)), glyph])
    )}} as unknown as GlyphMap;
}

export function createSymbolStyleLayer(layerId: string, font: string, text: string, extraLayout?: Record<string, unknown>): SymbolStyleLayer {
    const layer = new SymbolStyleLayer({
        id: layerId,
        type: 'symbol',
        layout: {'text-font': [font], 'text-field': text, ...extraLayout},
        filter: featureFilter(undefined, 'filter')
    } as any as LayerSpecification, {});
    layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
    return layer;
}

export function createSymbolBucket(layerId: string, font: string, text: string,  collisionBoxArray: CollisionBoxArray, extraLayout?: Record<string, unknown>): SymbolBucket {
    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray,
        layers: [createSymbolStyleLayer(layerId, font, text, extraLayout)]
    } as BucketParameters<SymbolStyleLayer>);
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

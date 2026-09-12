import {describe, test, expect} from 'vitest';
import {CollisionBoxArray} from '../data/array_types.g.ts';
import {SymbolBucket} from '../data/bucket/symbol_bucket.ts';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import {performSymbolLayout} from './symbol_layout.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';
import {AlphaImage} from '../util/image.ts';
import {featureFilter, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {CanonicalTileID} from '../tile/tile_id.ts';
import {createPopulateOptions} from '../../test/unit/lib/tile.ts';
import type {EvaluationParameters} from '../style/evaluation_parameters.ts';
import type {BucketParameters} from '../data/bucket.ts';

describe('performSymbolLayout', () => {
    test('keeps a vertical text symbol that lands at placedSymbolArray index 0', () => {
        const canonical = new CanonicalTileID(14, 8000, 6000);
        const layer = new SymbolStyleLayer({
            id: 'test',
            type: 'symbol',
            layout: {'text-font': ['Test'], 'text-field': '。', 'text-writing-mode': ['horizontal', 'vertical']},
            filter: featureFilter(undefined, 'filter')
        } as any as LayerSpecification, {});
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

        const bucket = new SymbolBucket({
            zoom: 0, overscaling: 1, collisionBoxArray: new CollisionBoxArray(), layers: [layer]
        } as BucketParameters<SymbolStyleLayer>);
        const feature = {extent: 8192, type: 1, id: 1, properties: {}, loadGeometry: () => [[{x: 100, y: 100}]]};
        bucket.populate([{feature, id: 1, index: 0, sourceLayerIndex: 0}] as any, createPopulateOptions([]), canonical);

        // Vertical shaping verticalizes '。' into '︒'. With a glyph for only that form, horizontal
        // shaping yields nothing and the vertical symbol becomes placedSymbolArray's first entry.
        const glyph = {bitmap: new AlphaImage({width: 30, height: 30}), metrics: {width: 18, height: 18, left: 0, top: -8, advance: 18}};
        performSymbolLayout({
            bucket, glyphMap: {Test: {'︒': glyph}}, glyphPositions: {}, imageMap: {}, imagePositions: {},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision, canonical
        } as any);

        expect(bucket.text.placedSymbolArray).toHaveLength(1);
        expect(bucket.symbolInstances.get(0).verticalPlacedTextSymbolIndex).toBe(0);
    });
});

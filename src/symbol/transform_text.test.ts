import {describe, expect, test} from 'vitest';
import {Formatted, FormattedSection} from '@maplibre/maplibre-gl-style-spec';
import {transformText} from './transform_text.ts';

import type {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import type {Feature} from '@maplibre/maplibre-gl-style-spec';

describe('transformText', () => {
    test('holds the letters of an Arabic word together as one cluster', () => {
        const layer = {
            layout: {get: () => ({evaluate: () => 'none'})}
        } as unknown as SymbolStyleLayer;
        const formatted = new Formatted([new FormattedSection('ڵا', null, null, null, null, null)]);
        const transformed = transformText(formatted, layer, {} as Feature);

        expect(transformed.sections[0].text).toBe('ڵ\u200dا');
    });

    test('changes the case of the text first, as the layer asks', () => {
        const layer = {
            layout: {get: () => ({evaluate: () => 'uppercase'})}
        } as unknown as SymbolStyleLayer;
        const formatted = new Formatted([new FormattedSection('hello', null, null, null, null, null)]);
        const transformed = transformText(formatted, layer, {} as Feature);

        expect(transformed.sections[0].text).toBe('HELLO');
    });
});

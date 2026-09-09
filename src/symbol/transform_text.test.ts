import {afterEach, describe, expect, test, vi} from 'vitest';
import {Formatted, FormattedSection} from '@maplibre/maplibre-gl-style-spec';
import {transformText} from './transform_text.ts';
import {rtlWorkerPlugin} from '../source/rtl_text_plugin_worker.ts';
import type {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import type {Feature} from '@maplibre/maplibre-gl-style-spec';

afterEach(() => {
    rtlWorkerPlugin.applyArabicShaping = null;
});

describe('transformText', () => {
    test('writes Arabic in the shapes its letters take, without a plugin', () => {
        const layer = {
            layout: {get: () => ({evaluate: () => 'none'})}
        } as unknown as SymbolStyleLayer;
        const formatted = new Formatted([new FormattedSection('مرحبا', null, null, null, null, null)]);
        const transformed = transformText(formatted, layer, {} as Feature);

        expect(transformed.sections[0].text).toBe('ﻣﺮﺣﺒﺎ');
    });

    test('changes the case of the text first, as the layer asks', () => {
        const layer = {
            layout: {get: () => ({evaluate: () => 'uppercase'})}
        } as unknown as SymbolStyleLayer;
        const formatted = new Formatted([new FormattedSection('hello', null, null, null, null, null)]);
        const transformed = transformText(formatted, layer, {} as Feature);

        expect(transformed.sections[0].text).toBe('HELLO');
    });

    test('hands the text to a registered plugin in place of the built-in shaping', () => {
        const pluginShaping = vi.fn().mockReturnValue('shaped by the plugin');
        rtlWorkerPlugin.applyArabicShaping = pluginShaping;

        const layer = {
            layout: {get: () => ({evaluate: () => 'none'})}
        } as unknown as SymbolStyleLayer;
        const formatted = new Formatted([new FormattedSection('مرحبا', null, null, null, null, null)]);
        const transformed = transformText(formatted, layer, {} as Feature);

        expect(pluginShaping).toHaveBeenCalledWith('مرحبا');
        expect(transformed.sections[0].text).toBe('shaped by the plugin');
    });
});

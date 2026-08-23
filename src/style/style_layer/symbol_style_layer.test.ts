import {describe, test, expect} from 'vitest';
import {SymbolStyleLayer} from './symbol_style_layer.ts';
import {type EvaluationParameters} from '../evaluation_parameters.ts';

function createSymbolLayer(layout: Record<string, unknown> = {}) {
    const layer = new SymbolStyleLayer({
        id: 'symbol',
        type: 'symbol',
        source: 'source',
        layout
    }, {});
    layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, []);
    return layer;
}

// These properties come from the patched style spec (see patches/), so assert they are
// actually present - a patch that stops applying would otherwise fail silently.
describe('SymbolStyleLayer symbol height properties', () => {
    test('symbol-height-offset defaults to 0', () => {
        expect(createSymbolLayer().layout.get('symbol-height-offset').evaluate({} as any, {})).toBe(0);
    });

    test('symbol-height-anchor defaults to ground', () => {
        expect(createSymbolLayer().layout.get('symbol-height-anchor')).toBe('ground');
    });

    test('symbol-height-anchor can be set to absolute', () => {
        const layer = createSymbolLayer({'symbol-height-anchor': 'absolute'});
        expect(layer.layout.get('symbol-height-anchor')).toBe('absolute');
    });

    test('symbol-height-offset is data-driven', () => {
        const layer = createSymbolLayer({'symbol-height-offset': ['get', 'height']});
        expect(layer.layout.get('symbol-height-offset').evaluate({properties: {height: 42}} as any, {})).toBe(42);
    });
});

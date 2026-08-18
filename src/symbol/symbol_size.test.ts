import {describe, test, expect} from 'vitest';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import {evaluateSizeForZoom, getSizeData} from './symbol_size.ts';

import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';

function createTextSizeValue(textSize: SymbolLayerSpecification['layout']['text-size']) {
    const layer = new SymbolStyleLayer({
        id: 'symbol',
        type: 'symbol',
        source: 'source',
        layout: {'text-size': textSize}
    }, {});
    return layer._unevaluatedLayout._values['text-size'];
}

describe('evaluateSizeForZoom', () => {
    test('reports the last stop\'s size above the last stop', () => {
        const sizeData = getSizeData(6, createTextSizeValue(['interpolate', ['linear'], ['zoom'], 1, 9, 4, 17]));

        const size = evaluateSizeForZoom(sizeData, 5);

        expect(size.uSize).toBe(17);
    });

    test('caps the size at the tile zoom + 1 size above the tile\'s own zoom range', () => {
        const sizeData = getSizeData(2, createTextSizeValue(['interpolate', ['linear'], ['zoom'], 1, 9, 4, 17]));

        const size = evaluateSizeForZoom(sizeData, 4);

        expect(size.uSize).toBeCloseTo(14.333333, 5);
    });

    test('keeps a zoom-referencing step base finite instead of evaluating it at -Infinity', () => {
        const sizeData = getSizeData(6, createTextSizeValue(['step', ['zoom'], ['*', ['zoom'], 2], 4, 17]));

        const size = evaluateSizeForZoom(sizeData, 2);

        expect(size.uSize).toBe(6);
    });
});

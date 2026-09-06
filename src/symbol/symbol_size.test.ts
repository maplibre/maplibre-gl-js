import {describe, test, expect} from 'vitest';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import {evaluateSizeForFeature, evaluateSizeForZoom, getSizeData} from './symbol_size.ts';

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
    test('reports the size at the camera zoom for a bucket built past the last stop', () => {
        const sizeData = getSizeData(6, createTextSizeValue(['interpolate', ['linear'], ['zoom'], 1, 9, 4, 17]));

        const size = evaluateSizeForZoom(sizeData, 2);

        expect(size.uSize).toBeCloseTo(11.666666, 5);
    });

    test('reports the first stop\'s size below the first stop', () => {
        const sizeData = getSizeData(6, createTextSizeValue(['interpolate', ['linear'], ['zoom'], 1, 9, 4, 17]));

        const size = evaluateSizeForZoom(sizeData, 0);

        expect(size.uSize).toBe(9);
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

    test('reports how far the camera zoom sits between a composite size\'s covering stops', () => {
        const sizeData = getSizeData(5, createTextSizeValue(['interpolate', ['linear'], ['zoom'], 1, ['get', 'size'], 4, ['*', ['get', 'size'], 2], 8, ['*', ['get', 'size'], 4]]));

        const size = evaluateSizeForZoom(sizeData, 6);

        expect(size.uSizeT).toBe(0.5);
        expect(size.uSize).toBe(0);
    });

    test('keeps a composite size at its lower covering stop below the tile\'s own zoom range', () => {
        const sizeData = getSizeData(5, createTextSizeValue(['interpolate', ['linear'], ['zoom'], 1, ['get', 'size'], 4, ['*', ['get', 'size'], 2], 8, ['*', ['get', 'size'], 4]]));

        const size = evaluateSizeForZoom(sizeData, 2);

        expect(size.uSizeT).toBe(0);
    });

    test('never blends a stepped composite size', () => {
        const sizeData = getSizeData(5, createTextSizeValue(['step', ['zoom'], ['get', 'size'], 4, ['*', ['get', 'size'], 2], 8, ['*', ['get', 'size'], 4]]));

        const size = evaluateSizeForZoom(sizeData, 6);

        expect(size.uSizeT).toBe(0);
    });
});

describe('evaluateSizeForFeature', () => {
    test('unpacks the feature\'s own size for a source size', () => {
        const sizeData = getSizeData(5, createTextSizeValue(['get', 'size']));

        const size = evaluateSizeForFeature(sizeData, {uSize: 0, uSizeT: 0}, {lowerSize: 1280, upperSize: 2560});

        expect(size).toBe(10);
    });

    test('blends the feature\'s two baked sizes for a composite size', () => {
        const sizeData = getSizeData(5, createTextSizeValue(['interpolate', ['linear'], ['zoom'], 1, ['get', 'size'], 4, ['*', ['get', 'size'], 2]]));

        const size = evaluateSizeForFeature(sizeData, {uSize: 0, uSizeT: 0.5}, {lowerSize: 1280, upperSize: 2560});

        expect(size).toBe(15);
    });

    test('reports the zoom uniform for a camera size, which has no per-feature data', () => {
        const sizeData = getSizeData(5, createTextSizeValue(['interpolate', ['linear'], ['zoom'], 1, 9, 4, 17]));

        const size = evaluateSizeForFeature(sizeData, {uSize: 12, uSizeT: 0}, {lowerSize: 1280, upperSize: 2560});

        expect(size).toBe(12);
    });
});

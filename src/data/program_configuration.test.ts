import {afterEach, describe, expect, test, vi} from 'vitest';

import {Color, type Feature} from '@maplibre/maplibre-gl-style-spec';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

import {createStyleLayer} from '../style/create_style_layer';
import {FeaturePositionMap} from './feature_position_map';
import {type EvaluationParameters} from '../style/evaluation_parameters';
import {type TransitionParameters} from '../style/properties';
import {packUint8ToFloat} from '../shaders/encode_attribute';
import {ProgramConfiguration} from './program_configuration';

import type {FillStyleLayer} from '../style/style_layer/fill_style_layer';

const feature = {
    type: 'Polygon',
    id: 'building',
    properties: {},
} as Feature;

const options = {imagePositions: {}};
const vtLayer = {feature: () => feature} as unknown as VectorTileLayerLike;

function createFillLayer(fillOutlineColor: any, fillColor: string = '#00f') {
    const layer = createStyleLayer({
        id: 'building',
        type: 'fill',
        source: 'streets',
        paint: {
            'fill-color': fillColor,
            'fill-outline-color': fillOutlineColor,
        },
    }, {}) as FillStyleLayer;
    layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, []);
    return layer;
}

function getPackedColor(color: Color) {
    return [
        packUint8ToFloat(255 * color.r, 255 * color.g),
        packUint8ToFloat(255 * color.b, 255 * color.a),
    ];
}

function readOutlineColor(programConfiguration: ProgramConfiguration) {
    const binder = programConfiguration.binders['fill-outline-color'] as unknown as {
        paintVertexArray: {arrayBuffer: ArrayBuffer};
    };
    return Array.from(new Float32Array(binder.paintVertexArray.arrayBuffer).slice(0, 2));
}

function createIndexedFeatureMap(featureId: string | number, index: number = 0, start: number = 0, end: number = 1) {
    const featureMap = new FeaturePositionMap();
    featureMap.add(featureId, index, start, end);
    return FeaturePositionMap.deserialize(FeaturePositionMap.serialize(featureMap, []));
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ProgramConfiguration', () => {
    test('does not throw or warn when fill-outline-color feature-state is missing', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createFillLayer(['feature-state', 'outline-color']);
        const programConfiguration = new ProgramConfiguration(layer, 0, () => true);

        expect(() => {
            programConfiguration.populatePaintArrays(1, feature, options);
        }).not.toThrow();
        expect(warn).not.toHaveBeenCalled();
    });

    test('updates fill-outline-color when source feature-state changes', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createFillLayer(['feature-state', 'outline-color']);
        const programConfiguration = new ProgramConfiguration(layer, 0, () => true);
        const featureMap = createIndexedFeatureMap('building');

        programConfiguration.populatePaintArrays(1, feature, options);
        expect(readOutlineColor(programConfiguration)).toEqual(getPackedColor(new Color(0, 0, 1, 1)));

        expect(programConfiguration.updatePaintArrays({'building': {'outline-color': '#f00'}}, featureMap, vtLayer, layer, options)).toBe(true);
        expect(readOutlineColor(programConfiguration)).toEqual(getPackedColor(new Color(1, 0, 0, 1)));
        expect(warn).not.toHaveBeenCalled();
    });

    test('does not throw or warn when composite fill-outline-color feature-state is missing', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createFillLayer([
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            ['feature-state', 'outline-color'],
            1,
            ['feature-state', 'outline-color'],
        ]);
        const programConfiguration = new ProgramConfiguration(layer, 0, () => true);

        expect(() => {
            programConfiguration.populatePaintArrays(1, feature, options);
        }).not.toThrow();
        expect(warn).not.toHaveBeenCalled();
    });

    test('updates fill-outline-color when composite feature-state changes', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createFillLayer([
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            ['feature-state', 'outline-color'],
            1,
            ['feature-state', 'outline-color'],
        ]);
        const programConfiguration = new ProgramConfiguration(layer, 0, () => true);
        const featureMap = createIndexedFeatureMap('building');

        programConfiguration.populatePaintArrays(1, feature, options);
        expect(readOutlineColor(programConfiguration)).toEqual(getPackedColor(new Color(0, 0, 1, 1)));

        expect(programConfiguration.updatePaintArrays({'building': {'outline-color': '#f00'}}, featureMap, vtLayer, layer, options)).toBe(true);
        expect(readOutlineColor(programConfiguration)).toEqual(getPackedColor(new Color(1, 0, 0, 1)));
        expect(warn).not.toHaveBeenCalled();
    });

    test('uses the latest fill-color as the fallback after paint updates', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createFillLayer(['feature-state', 'outline-color']);
        const programConfiguration = new ProgramConfiguration(layer, 0, () => true);
        const featureMap = createIndexedFeatureMap('building');

        programConfiguration.populatePaintArrays(1, feature, options);
        expect(readOutlineColor(programConfiguration)).toEqual(getPackedColor(new Color(0, 0, 1, 1)));

        layer.setPaintProperty('fill-color', '#0f0');
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, []);
        expect(programConfiguration.updatePaintArrays({'building': {}}, featureMap, vtLayer, layer, options)).toBe(true);

        expect(readOutlineColor(programConfiguration)).toEqual(getPackedColor(new Color(0, 1, 0, 1)));
        expect(warn).not.toHaveBeenCalled();
    });

    test('warns for invalid feature-state colors but does not break rendering', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createFillLayer(['feature-state', 'outline-color']);
        const programConfiguration = new ProgramConfiguration(layer, 0, () => true);
        const featureMap = createIndexedFeatureMap('building');

        programConfiguration.populatePaintArrays(1, feature, options);

        expect(programConfiguration.updatePaintArrays({'building': {'outline-color': 'not-a-color'}}, featureMap, vtLayer, layer, options)).toBe(true);

        expect(readOutlineColor(programConfiguration)).toEqual(getPackedColor(new Color(0, 0, 1, 1)));
        expect(warn).toHaveBeenCalledWith('Could not parse color from value \'not-a-color\'');
    });
});

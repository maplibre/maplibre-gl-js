import {describe, expect, test} from 'vitest';
import {compositePaintSampleZooms, ProgramConfiguration} from './program_configuration.ts';
import {FillExtrusionStyleLayer} from '../style/style_layer/fill_extrusion_style_layer.ts';
import {EvaluationParameters} from '../style/evaluation_parameters.ts';

import type {Feature, FillExtrusionLayerSpecification} from '@maplibre/maplibre-gl-style-spec';

describe('compositePaintSampleZooms', () => {
    test('uses a stop pair that sits entirely inside one integer zoom', () => {
        expect(compositePaintSampleZooms(15, [15, 15.05], false)).toEqual({minZoom: 15, maxZoom: 15.05});
    });

    test('keeps a ramp that crosses an integer zoom on those stops', () => {
        expect(compositePaintSampleZooms(15, [15, 16], false)).toEqual({minZoom: 15, maxZoom: 16});
    });

    test('covers the tile zoom with the stop pair that straddles it', () => {
        expect(compositePaintSampleZooms(15, [14.5, 15.5], false)).toEqual({minZoom: 14.5, maxZoom: 15.5});
    });

    test('samples at tileZoom and tileZoom + 1 when the property uses integer zoom', () => {
        expect(compositePaintSampleZooms(15, [15, 15.05], true)).toEqual({minZoom: 15, maxZoom: 16});
    });
});

describe('CompositeExpressionBinder', () => {
    test('finishes a fractional composite interpolate at its own stop', () => {
        const binder = createHeightBinder({
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']]
        });

        expect(interpolationFactor(binder, 15)).toBe(0);
        expect(interpolationFactor(binder, 15.05)).toBe(1);
        expect(interpolationFactor(binder, 15.5)).toBe(1);
    });

    test('still blends a cross-integer composite interpolate across the integer zoom', () => {
        const binder = createHeightBinder({
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, ['get', 'height']]
        });

        expect(interpolationFactor(binder, 15.5)).toBe(0.5);
    });

    test('evaluates the paint attribute at the covering stops', () => {
        const configuration = createHeightConfiguration({
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, ['get', 'height']]
        });
        configuration.populatePaintArrays(1, createHeightFeature(100), {imagePositions: {}});
        const binder = heightBinder(configuration);

        expect(binder.paintVertexArray.float32[0]).toBe(0);
        expect(binder.paintVertexArray.float32[1]).toBe(100);
    });
});

function createHeightConfiguration(
    paint: FillExtrusionLayerSpecification['paint'],
    zoom = 15
): ProgramConfiguration {
    const layer = new FillExtrusionStyleLayer({
        id: 'extrusion',
        type: 'fill-extrusion',
        source: 'geojson',
        paint
    }, {});
    layer.recalculate(new EvaluationParameters(zoom), []);
    return new ProgramConfiguration(layer, zoom, () => true);
}

function createHeightBinder(paint: FillExtrusionLayerSpecification['paint'], zoom = 15) {
    return heightBinder(createHeightConfiguration(paint, zoom));
}

function heightBinder(configuration: ProgramConfiguration) {
    return configuration.binders['fill-extrusion-height'] as {
        paintVertexArray: {float32: Float32Array};
        setUniform(uniform: {set: (value: number) => void}, globals: {zoom: number}): void;
    };
}

function interpolationFactor(
    binder: {setUniform(uniform: {set: (value: number) => void}, globals: {zoom: number}): void},
    zoom: number
): number {
    let factor = NaN;
    binder.setUniform({set(value: number) { factor = value; }}, {zoom});
    return factor;
}

function createHeightFeature(height: number): Feature {
    return {type: 'Polygon', properties: {height}};
}

import {describe, test, expect, vi, afterEach, beforeEach} from 'vitest';
import {ColorArray} from '@maplibre/maplibre-gl-style-spec';
import {DataDrivenProperty, Layout, PossiblyEvaluatedPropertyValue, PropertyValue, Transitionable} from './properties.ts';
import symbolProperties from './style_layer/symbol_style_layer_properties.g.ts';
import hillshadeProperties from './style_layer/hillshade_style_layer_properties.g.ts';
import {type EvaluationParameters} from './evaluation_parameters.ts';

describe('PropertyValue', () => {
    test('set global state', () => {
        const propertyValue = new PropertyValue(symbolProperties.layout.properties['text-size'], ['global-state', 'size'], 'text-size', {size: 17});
        expect(propertyValue.expression.evaluate({} as EvaluationParameters)).toBe(17);
    });

    describe('runtime error logging', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        test('warns with the supplied rootKey when an expression errors at runtime', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const propertyValue = new PropertyValue(
                symbolProperties.layout.properties['text-size'],
                ['number', ['get', 'size']],
                'layers[3].layout.text-size',
                undefined
            );

            const result = propertyValue.expression.evaluate(
                {zoom: 0},
                {type: 1, properties: {size: 'not-a-number'}} as any
            );

            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toBe('layers[3].layout.text-size: Expected value to be of type number, but found string instead. Falling back to 16.');
            expect(result).toBe(symbolProperties.layout.properties['text-size'].specification.default);
        });
    });
});

describe('Layout', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('set global state', () => {
        const layout = new Layout(symbolProperties.layout, 'layers[0].layout', {textSize: 15, textTransform: 'uppercase'});
        layout.setValue('text-size', ['global-state', 'textSize']);
        layout.setValue('text-transform', ['global-state', 'textTransform']);
        const _layout = layout.possiblyEvaluate({} as EvaluationParameters);
        expect(_layout.get('text-size').evaluate()).toBe(15);
        expect(_layout.get('text-transform').evaluate()).toBe('uppercase');
    });

    test('hasProperty returns true for known layout properties', () => {
        const layout = new Layout(symbolProperties.layout, 'layers[0].layout', {});
        expect(layout.hasProperty('text-size')).toBe(true);
        expect(layout.hasProperty('text-transform')).toBe(true);
    });

    test('hasProperty returns false for unknown properties', () => {
        const layout = new Layout(symbolProperties.layout, 'layers[0].layout', {});
        expect(layout.hasProperty('nonexistent')).toBe(false);
    });

    test('prefixes the layer location onto the runtime warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const layout = new Layout(symbolProperties.layout, 'layers[0].layout', {});
        layout.setValue('text-size', ['number', ['get', 'size']]);
        const _layout = layout.possiblyEvaluate({zoom: 0} as EvaluationParameters);
        _layout.get('text-size').evaluate({type: 1, properties: {size: 'not-a-number'}} as any, {} as any);

        expect(warn.mock.calls[0][0]).toBe('layers[0].layout.text-size: Expected value to be of type number, but found string instead. Falling back to 16.');
    });
});

describe('Transitionable', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('hasProperty returns true for known paint properties', () => {
        const transitionable = new Transitionable(symbolProperties.paint, 'layers[0].paint', {});
        expect(transitionable.hasProperty('text-color')).toBe(true);
        expect(transitionable.hasProperty('text-opacity')).toBe(true);
    });

    test('hasProperty returns false for unknown properties', () => {
        const transitionable = new Transitionable(symbolProperties.paint, 'layers[0].paint', {});
        expect(transitionable.hasProperty('nonexistent')).toBe(false);
    });

    test('prefixes the layer location onto the runtime warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const transitionable = new Transitionable(symbolProperties.paint, 'layers[0].paint', {});
        transitionable.setValue('text-color', ['to-color', ['get', 'col']]);
        const evaluated = transitionable.untransitioned().possiblyEvaluate({zoom: 0} as EvaluationParameters);
        evaluated.get('text-color').evaluate({type: 1, properties: {col: 'oops blue'}} as any, {} as any);

        expect(warn.mock.calls[0][0]).toBe('layers[0].paint.text-color: Could not parse color from value \'oops blue\' Falling back to rgba(0,0,0,1).');
    });
});

describe('paint property transitions between arrays of different length, issue #6606', () => {
    const transition = {duration: 300, delay: 0};

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function evaluateMidTransition(from: string[], to: string[]) {
        const transitionable = new Transitionable(hillshadeProperties.paint, '', {});

        transitionable.setValue('hillshade-highlight-color', from);
        let transitioning = transitionable.transitioned(
            {now: 0, transition}, transitionable.untransitioned());
        transitioning.possiblyEvaluate({zoom: 0, now: 0} as EvaluationParameters, undefined, []);

        transitionable.setValue('hillshade-highlight-color', to);
        transitioning = transitionable.transitioned({now: 0, transition}, transitioning);

        // Halfway through the 300ms transition, where interpolation is attempted.
        return transitioning
            .possiblyEvaluate({zoom: 0, now: 150} as EvaluationParameters, undefined, [])
            .get('hillshade-highlight-color');
    }

    test('removing a light snaps to the new colors instead of throwing', () => {
        const result = evaluateMidTransition(
            ['#ffffff', '#ff0000', '#00ff00', '#0000ff'],
            ['#ffffff', '#ff0000', '#00ff00']
        );

        expect(result.values).toHaveLength(3);
        expect(result).toEqual(ColorArray.parse(['#ffffff', '#ff0000', '#00ff00']));
    });

    test('adding a light snaps to the new colors instead of throwing', () => {
        const result = evaluateMidTransition(
            ['#ffffff', '#ff0000'],
            ['#ffffff', '#ff0000', '#00ff00']
        );

        expect(result.values).toHaveLength(3);
        expect(result).toEqual(ColorArray.parse(['#ffffff', '#ff0000', '#00ff00']));
    });

    test('a same-length change still interpolates normally', () => {
        const result = evaluateMidTransition(
            ['#000000', '#000000'],
            ['#ffffff', '#ffffff']
        );

        expect(result.values).toHaveLength(2);
        for (const color of result.values) {
            expect(color.r).toBeGreaterThan(0);
            expect(color.r).toBeLessThan(1);
        }
    });
});

describe('DataDrivenProperty.interpolate between arrays of different length, issue #6606', () => {
    const property = new DataDrivenProperty<ColorArray>({type: 'colorArray'} as any, 'color-array');

    function constant(value: ColorArray) {
        return new PossiblyEvaluatedPropertyValue<ColorArray>(
            property, {kind: 'constant', value}, {} as EvaluationParameters);
    }

    test('a length change snaps to the target value instead of throwing', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const from = constant(ColorArray.parse(['#ffffff', '#ff0000', '#00ff00', '#0000ff']));
        const to = constant(ColorArray.parse(['#ffffff', '#ff0000', '#00ff00']));

        const result = property.interpolate(from, to, 0.5);

        expect(result.value).toEqual({kind: 'constant', value: ColorArray.parse(['#ffffff', '#ff0000', '#00ff00'])});
    });

    test('a same-length change still interpolates normally', () => {
        const a = ColorArray.parse(['#000000', '#000000']);
        const b = ColorArray.parse(['#ffffff', '#ffffff']);

        const result = property.interpolate(constant(a), constant(b), 0.5);

        expect(result.value).toEqual({kind: 'constant', value: ColorArray.interpolate(a, b, 0.5)});
    });
});

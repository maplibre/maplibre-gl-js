import {describe, test, expect, vi, afterEach} from 'vitest';
import {Layout, PropertyValue, Transitionable} from './properties';
import symbolProperties from './style_layer/symbol_style_layer_properties.g';
import {type EvaluationParameters} from './evaluation_parameters';

describe('PropertyValue', () => {
    test('set global state', () => {
        const propertyValue = new PropertyValue(symbolProperties.layout.properties['text-size'], ['global-state', 'size'], {size: 17});
        expect(propertyValue.expression.evaluate({} as EvaluationParameters)).toBe(17);
    });

    describe('runtime error logging', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        test('warns with the property name when an expression errors at runtime', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const propertyValue = new PropertyValue(
                symbolProperties.layout.properties['text-size'],
                ['number', ['get', 'size']],
                undefined
            );

            const result = propertyValue.expression.evaluate(
                {zoom: 0} as EvaluationParameters,
                {type: 1, properties: {size: 'not-a-number'}} as any
            );

            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toBe('text-size: Expected value to be of type number, but found string instead. Falling back to 16.');
            expect(result).toBe(symbolProperties.layout.properties['text-size'].specification.default);
        });
    });
});

describe('Layout', () => {
    test('set global state', () => {
        const layout = new Layout(symbolProperties.layout, {textSize: 15, textTransform: 'uppercase'});
        layout.setValue('text-size', ['global-state', 'textSize']);
        layout.setValue('text-transform', ['global-state', 'textTransform']);
        const _layout = layout.possiblyEvaluate({} as EvaluationParameters);
        expect(_layout.get('text-size').evaluate()).toBe(15);
        expect(_layout.get('text-transform').evaluate()).toBe('uppercase');
    });

    test('hasProperty returns true for known layout properties', () => {
        const layout = new Layout(symbolProperties.layout, {});
        expect(layout.hasProperty('text-size')).toBe(true);
        expect(layout.hasProperty('text-transform')).toBe(true);
    });

    test('hasProperty returns false for unknown properties', () => {
        const layout = new Layout(symbolProperties.layout, {});
        expect(layout.hasProperty('nonexistent')).toBe(false);
    });
});

describe('Transitionable', () => {
    test('hasProperty returns true for known paint properties', () => {
        const transitionable = new Transitionable(symbolProperties.paint, {});
        expect(transitionable.hasProperty('text-color')).toBe(true);
        expect(transitionable.hasProperty('text-opacity')).toBe(true);
    });

    test('hasProperty returns false for unknown properties', () => {
        const transitionable = new Transitionable(symbolProperties.paint, {});
        expect(transitionable.hasProperty('nonexistent')).toBe(false);
    });
});

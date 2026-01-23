import {describe, test, expect} from 'vitest';
import {Layout, PropertyValue, DataConstantProperty} from './properties';
import symbolProperties from './style_layer/symbol_style_layer_properties.g';
import {type EvaluationParameters} from './evaluation_parameters';

describe('PropertyValue', () => {
    test('set global state', () => {
        const propertyValue = new PropertyValue(symbolProperties.layout.properties['text-size'], ['global-state', 'size'], {size: 17});
        expect(propertyValue.expression.evaluate({} as EvaluationParameters)).toBe(17);
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
});

describe('DataConstantProperty', () => {
    test('interpolate skips interpolation on array length mismatch', () => {
        const prop = new DataConstantProperty({type: 'color', value: 'color'} as any);
        const a = [0, 0, 0, 1];
        const b = [0, 0, 0];
        
        // standard color array interpolation would crash here if passed to style-spec
        // With fix, it should return a or b depending on t
        expect(prop.interpolate(a, b, 0.4)).toBe(a);
        expect(prop.interpolate(a, b, 0.6)).toBe(b);
    });
});

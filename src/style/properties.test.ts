import {describe, test, expect} from 'vitest';
import {Layout, PropertyValue} from './properties';
import symbolProperties from './style_layer/symbol_style_layer_properties.g';
import {type EvaluationParameters} from './evaluation_parameters';

describe('PropertyValue', () => {
    test('set global state', () => {
        const propertyValue = new PropertyValue(symbolProperties.layout.properties['text-size'], ['global-state', 'size'], {});
        expect(propertyValue.expression.evaluate({globalState: {size: 17}} as unknown as EvaluationParameters)).toBe(17);
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

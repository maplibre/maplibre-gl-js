import {EvaluationContext, FormattedSection, createExpression, StyleExpression, ZoomConstantExpression} from '@maplibre/maplibre-gl-style-spec';
import properties from './style_layer/symbol_style_layer_properties.g';
import {PossiblyEvaluatedPropertyValue} from './properties';
import {FormatSectionOverride} from './format_section_override';
import {EvaluationParameters} from './evaluation_parameters';

describe('evaluate', () => {

    test('override constant', () => {
        const defaultColor = {'r': 0, 'g': 1, 'b': 0, 'a': 1};
        const overriddenColor = {'r': 1, 'g': 0, 'b': 0, 'a': 1};
        const overridden = new PossiblyEvaluatedPropertyValue(
            properties.paint.properties['text-color'],
            {kind: 'constant', value: defaultColor},
            {zoom: 0, zoomHistory: {}} as EvaluationParameters
        );

        const override = new FormatSectionOverride(overridden);
        const ctx = new EvaluationContext();
        ctx.feature = {} as any;
        ctx.featureState = {};
        expect(override.evaluate(ctx)).toEqual(defaultColor);

        ctx.formattedSection = {textColor: overriddenColor} as FormattedSection;
        expect(override.evaluate(ctx)).toEqual(overriddenColor);

    });

    test('override expression', () => {
        const warn = console.warn;
        console.warn = (_) => {};
        const defaultColor = {'r': 0, 'g': 0, 'b': 0, 'a': 1};
        const propertyColor = {'r': 1, 'g': 0, 'b': 0, 'a': 1};
        const overriddenColor = {'r': 0, 'g': 0, 'b': 1, 'a': 1};
        const styleExpr = createExpression(
            ['get', 'color'],
            properties.paint.properties['text-color'].specification);

        const sourceExpr = new ZoomConstantExpression('source', styleExpr.value as StyleExpression);
        const overridden = new PossiblyEvaluatedPropertyValue(
            properties.paint.properties['text-color'],
            sourceExpr,
            {zoom: 0, zoomHistory: {}} as EvaluationParameters
        );

        const override = new FormatSectionOverride(overridden);
        const ctx = new EvaluationContext();
        ctx.feature = {properties: {}} as any;
        ctx.featureState = {};

        expect(override.evaluate(ctx)).toEqual(defaultColor);

        ctx.feature.properties.color = 'red';
        expect(override.evaluate(ctx)).toEqual(propertyColor);

        ctx.formattedSection = {textColor: overriddenColor} as FormattedSection;
        expect(override.evaluate(ctx)).toEqual(overriddenColor);

        console.warn = warn;
    });

});

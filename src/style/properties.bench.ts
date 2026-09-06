import {bench, describe} from 'vitest';
import {latest as spec, convertFunction, isFunction, createFunction, createPropertyExpression} from '@maplibre/maplibre-gl-style-spec';
import brightV9 from '../../test/integration/assets/styles/bright-v9.json' with {type: 'json'};

import type {StyleSpecification, StylePropertyExpression, StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';

type Sample = {
    propertySpec: StylePropertySpecification;
    rawValue: unknown;
    rawExpression: unknown;
    compiledFunction: StylePropertyExpression;
    compiledExpression: StylePropertyExpression;
};

function sample(rawValue: unknown, propertySpec: StylePropertySpecification): Sample {
    const rawExpression = convertFunction(rawValue, propertySpec);
    const compiledFunction = createFunction(rawValue, propertySpec) as StylePropertyExpression;
    const compiledExpression = createPropertyExpression(rawExpression, 'expression', propertySpec);
    if (compiledExpression.result === 'error') {
        throw new Error(compiledExpression.value.map(err => `${err.key}: ${err.message}`).join(', '));
    }
    return {
        propertySpec,
        rawValue,
        rawExpression,
        compiledFunction,
        compiledExpression: compiledExpression.value
    };
}

function collect(style: StyleSpecification): Sample[] {
    const samples: Sample[] = [];

    for (const layer of style.layers) {
        if (!layer.type) {
            continue;
        }

        for (const key in layer.paint) {
            if (isFunction(layer.paint[key])) {
                samples.push(sample(layer.paint[key], spec[`paint_${layer.type}`][key]));
            }
        }

        for (const key in layer.layout) {
            if (isFunction(layer.layout[key])) {
                samples.push(sample(layer.layout[key], spec[`layout_${layer.type}`][key]));
            }
        }
    }

    return samples;
}

const samples = collect(brightV9 as unknown as StyleSpecification);

describe('style property functions', () => {
    bench('createFunction', () => {
        for (const {rawValue, propertySpec} of samples) {
            createFunction(rawValue, propertySpec);
        }
    });

    bench('evaluate function', () => {
        for (const {compiledFunction} of samples) {
            compiledFunction.evaluate({zoom: 0});
        }
    });

    bench('createPropertyExpression', () => {
        for (const {rawExpression, propertySpec} of samples) {
            createPropertyExpression(rawExpression, 'expression', propertySpec);
        }
    });

    bench('evaluate expression', () => {
        for (const {compiledExpression} of samples) {
            compiledExpression.evaluate({zoom: 0});
        }
    });
});

import {describe, test, expect} from 'vitest';
import {ColorArray} from '@maplibre/maplibre-gl-style-spec';
import {Layout, PropertyValue, Transitionable} from './properties.ts';
import symbolProperties from './style_layer/symbol_style_layer_properties.g.ts';
import hillshadeProperties from './style_layer/hillshade_style_layer_properties.g.ts';
import {type EvaluationParameters} from './evaluation_parameters.ts';

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

// Adding or removing a hillshade light changes the colorArray length, which cannot be interpolated (#6606).
describe('paint property transitions between arrays of different length', () => {
    const transition = {duration: 300, delay: 0};

    function evaluateMidTransition(from: string[], to: string[]) {
        const transitionable = new Transitionable(hillshadeProperties.paint, {});

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

        // Halfway through an eased transition the colors are strictly between black and white.
        expect(result.values).toHaveLength(2);
        for (const color of result.values) {
            expect(color.r).toBeGreaterThan(0);
            expect(color.r).toBeLessThan(1);
        }
    });
});

import {describe, test, expect, vi, afterEach} from 'vitest';
import {Light} from './light.ts';
import {Color, latest as styleSpec, type LightSpecification} from '@maplibre/maplibre-gl-style-spec';
import {sphericalToCartesian} from '../util/util.ts';
import {type EvaluationParameters} from './evaluation_parameters.ts';
import {type TransitionParameters} from './properties.ts';

const spec = styleSpec.light;

test('Light with defaults', () => {
    const light = new Light({});
    light.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters);

    expect(light.properties.get('anchor')).toEqual(spec.anchor.default);
    expect(light.properties.get('position')).toEqual(spec.position.default);
    expect(light.getCartesianPosition()).toEqual(sphericalToCartesian(spec.position.default as [number, number, number]));
    expect(light.properties.get('intensity')).toEqual(spec.intensity.default);
    expect(light.properties.get('color')).toEqual(Color.parse(spec.color.default));
});

test('Light with options', () => {
    const light = new Light({
        anchor: 'map',
        position: [2, 30, 30],
        intensity: 1
    });
    light.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters);

    expect(light.properties.get('anchor')).toBe('map');
    expect(light.properties.get('position')).toEqual([2, 30, 30]);
    expect(light.getCartesianPosition()).toEqual(sphericalToCartesian([2, 30, 30]));
    expect(light.properties.get('intensity')).toBe(1);
    expect(light.properties.get('color')).toEqual(Color.parse(spec.color.default));
});

test('Light with stops function', () => {
    const light = new Light({
        intensity: {
            stops: [[16, 0.2], [17, 0.8]]
        }
    } as LightSpecification);
    light.recalculate({zoom: 16.5, zoomHistory: {}} as EvaluationParameters);

    expect(light.properties.get('intensity')).toBe(0.5);
});

test('Light.getLight', () => {
    const defaults = {};
    for (const key in spec) {
        defaults[key] = spec[key].default;
    }

    expect(new Light(defaults).getLight()).toEqual(defaults);
});

describe('Light.setLight', () => {
    test('sets light', () => {
        const light = new Light({});
        light.setLight({color: 'red', 'color-transition': {duration: 3000}});
        light.updateTransitions({transition: true} as any as TransitionParameters);
        light.recalculate({zoom: 16, zoomHistory: {}, now: 1500} as EvaluationParameters);
        expect(light.properties.get('color')).toEqual(new Color(1, 0.5, 0.5, 1));
    });

    test('validates by default', () => {
        const light = new Light({});
        const lightSpy = vi.spyOn(light, '_validate');
        vi.spyOn(console, 'error').mockImplementation(() => { });
        light.setLight({color: 'notacolor'});
        light.updateTransitions({transition: false} as any as TransitionParameters);
        light.recalculate({zoom: 16, zoomHistory: {}, now: 10} as EvaluationParameters);
        expect(lightSpy).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(lightSpy.mock.calls[0][2]).toEqual({});
    });

    test('respects validation option', () => {
        const light = new Light({});

        const lightSpy = vi.spyOn(light, '_validate');
        light.setLight({color: [999]} as any, {validate: false});
        light.updateTransitions({transition: false} as any as TransitionParameters);
        light.recalculate({zoom: 16, zoomHistory: {}, now: 10} as EvaluationParameters);

        expect(lightSpy).toHaveBeenCalledTimes(1);
        expect(lightSpy.mock.calls[0][2]).toEqual({validate: false});
        expect(light.properties.get('color')).toEqual([999]);
    });
});

describe('Light runtime error logging', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('warns with the light property location when an expression errors at runtime', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const light = new Light({});
        // global-state defeats constant-folding, so this fails at evaluation time (not parse time).
        light.setLight({intensity: ['number', ['global-state', 'missing']]} as any, {validate: false});
        light.updateTransitions({transition: false} as any as TransitionParameters);
        light.recalculate({zoom: 16, zoomHistory: {}, now: 10} as EvaluationParameters);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toBe('light.intensity: Expected value to be of type number, but found null instead. Falling back to 0.5.');
    });
});

import {describe, expect, test, vi} from 'vitest';
import {Sky} from './sky';
import {latest as styleSpec, type SkySpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from './evaluation_parameters';
import {type TransitionParameters} from './properties';

const spec = styleSpec.sky;

test('Sky with defaults', () => {
    const sky = new Sky({});
    sky.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters);

    expect(sky.properties.get('atmosphere-blend')).toEqual(spec['atmosphere-blend'].default);
});

test('Sky with options', () => {
    const sky = new Sky({
        'atmosphere-blend': 0.4
    });
    sky.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters);

    expect(sky.properties.get('atmosphere-blend')).toBe(0.4);
});

test('Sky with interpolate function', () => {
    const sky = new Sky({
        'atmosphere-blend': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            5, 1,
            7, 0
        ]
    } as SkySpecification);
    sky.recalculate({zoom: 6, zoomHistory: {}} as EvaluationParameters);

    expect(sky.properties.get('atmosphere-blend')).toBe(0.5);
});

test('Sky.getSky', () => {
    const defaults = {'atmosphere-blend': 0.8};

    expect(new Sky(defaults).getSky()).toEqual(defaults);
});

describe('Sky.setSky', () => {
    test('sets Sky', () => {
        const sky = new Sky({});
        sky.setSky({'atmosphere-blend': 1} as SkySpecification);
        sky.updateTransitions({
            now: 0,
            transition: {
                duration: 3000,
                delay: 0
            }
        } as any as TransitionParameters);
        sky.recalculate({zoom: 16, zoomHistory: {}, now: 1500} as EvaluationParameters);
        expect(sky.properties.get('atmosphere-blend')).toBe(0.9);
    });

    test('validates by default', () => {
        const sky = new Sky({});
        const skySpy = vi.spyOn(sky, '_validate');
        vi.spyOn(console, 'error').mockImplementation(() => { });
        sky.setSky({'atmosphere-blend': -1});
        sky.updateTransitions({transition: false} as any as TransitionParameters);
        sky.recalculate({zoom: 16, zoomHistory: {}, now: 10} as EvaluationParameters);
        expect(skySpy).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(skySpy.mock.calls[0][2]).toEqual({});
    });

    test('respects validation option', () => {
        const sky = new Sky({});

        const skySpy = vi.spyOn(sky, '_validate');
        sky.setSky({'atmosphere-blend': -1} as any, {validate: false});
        sky.updateTransitions({transition: false} as any as TransitionParameters);
        sky.recalculate({zoom: 16, zoomHistory: {}, now: 10} as EvaluationParameters);

        expect(skySpy).toHaveBeenCalledTimes(1);
        expect(skySpy.mock.calls[0][2]).toEqual({validate: false});
        expect(sky.properties.get('atmosphere-blend')).toBe(-1);
    });
});

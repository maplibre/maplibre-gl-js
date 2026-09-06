import {describe, test, expect, vi, afterEach} from 'vitest';
import {GlobeProjection} from './globe_projection.ts';
import {createProjectionFromName} from './projection_factory.ts';
import {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import type {TransitionParameters} from '../../style/properties.ts';

describe('GlobeProjection runtime error logging', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('warns with the projection property location when an expression errors at runtime', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const projection = new GlobeProjection(undefined, {});
        // global-state defeats constant-folding, so this fails at evaluation time (not parse time).
        projection.setProjection({type: ['string', ['global-state', 'missing']]} as any);
        projection.updateTransitions({transition: false} as any as TransitionParameters);
        projection.recalculate(new EvaluationParameters(16));

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toBe('projection.type: Expected value to be of type string, but found null instead. Falling back to mercator.');
    });
});

describe('GlobeProjection.transitionStateAtZoom', () => {
    test('evaluates the projection expression at the given zoom without recalculating the current state', () => {
        const projection = createProjectionFromName('globe', undefined, {}).projection;
        projection.recalculate(new EvaluationParameters(15));
        expect(projection.transitionState).toBe(0);

        expect(projection.transitionStateAtZoom(10)).toBe(1);
        expect(projection.transitionStateAtZoom(11.5)).toBeCloseTo(0.5, 9);
        expect(projection.transitionStateAtZoom(13)).toBe(0);
        expect(projection.transitionState).toBe(0);
    });

    test('follows a custom projection expression', () => {
        const projection = new GlobeProjection({type: ['interpolate', ['linear'], ['zoom'], 1, 'vertical-perspective', 2, 'mercator']} as any, {});
        expect(projection.transitionStateAtZoom(0.5)).toBe(1);
        expect(projection.transitionStateAtZoom(4)).toBe(0);
    });
});

import {describe, test, expect, vi, afterEach} from 'vitest';
import {GlobeProjection} from './globe_projection.ts';
import {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {type TransitionParameters} from '../../style/properties.ts';

describe('GlobeProjection runtime error logging', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('warns with the projection property location when an expression errors at runtime', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const projection = new GlobeProjection();
        // global-state defeats constant-folding, so this fails at evaluation time (not parse time).
        projection.setProjection({type: ['string', ['global-state', 'missing']]} as any);
        projection.updateTransitions({transition: false} as any as TransitionParameters);
        projection.recalculate(new EvaluationParameters(16));

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toBe('projection.type: Expected value to be of type string, but found null instead. Falling back to mercator.');
    });
});

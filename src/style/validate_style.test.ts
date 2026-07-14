import {describe, test, expect, vi, afterEach} from 'vitest';
import {emitValidationErrors, validateAndEmit, validateFilter} from './validate_style.ts';
import {Evented} from '../util/evented.ts';

afterEach(() => {
    vi.restoreAllMocks();
});

class TestEmitter extends Evented {}

/** An emitter that collects the messages of the {@link ErrorEvent}s fired at it, plus a `console.warn` spy. */
function setup() {
    const emitter = new TestEmitter();
    const fired: string[] = [];
    emitter.on('error', ({error}) => fired.push(error.message));
    return {emitter, fired, warn: vi.spyOn(console, 'warn').mockImplementation(() => {})};
}

describe('emitValidationErrors', () => {
    test('fires and fails on errors, logs warnings, and skips canvas sources', () => {
        const {emitter, fired, warn} = setup();

        const hasErrors = emitValidationErrors(emitter, [
            {message: 'a warning', severity: 'warning'},
            // Canvas sources are added at runtime, so their errors are ignored.
            {message: 'a canvas error', identifier: 'source.canvas', severity: 'error'},
            {message: 'an error', severity: 'error'},
            // Custom layers report errors without a severity; they must still count as errors.
            {message: 'an error with no severity'}
        ]);

        expect(hasErrors).toBe(true);
        expect(fired).toEqual(['an error', 'an error with no severity']);
        expect(warn).toHaveBeenCalledExactlyOnceWith('a warning');
    });

    test('reports no failure when there is nothing to emit', () => {
        const {emitter, fired} = setup();

        expect(emitValidationErrors(emitter, [])).toBe(false);
        expect(emitValidationErrors(emitter, null)).toBe(false);
        expect(fired).toEqual([]);
    });
});

describe('validateAndEmit', () => {
    const key = 'layers.symbol.filter';

    test('fails on a filter the spec rejects', () => {
        const {emitter, fired} = setup();

        const hasErrors = validateAndEmit(emitter, validateFilter, {
            key,
            value: ['all', ['==', ['get', 'class'], 'rail'], ['nope', 1]]
        });

        expect(hasErrors).toBe(true);
        expect(fired).toEqual([expect.stringContaining('Unknown expression "nope"')]);
    });

    test('only warns for a filter that mixes legacy syntax into an expression, so the style keeps loading', () => {
        const {emitter, fired, warn} = setup();

        const hasErrors = validateAndEmit(emitter, validateFilter, {
            key,
            value: ['all', ['==', ['get', 'class'], 'rail'], ['in', 'name', '']]
        });

        expect(hasErrors).toBe(false);
        expect(fired).toEqual([]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Mixing deprecated filter syntax with expression syntax'));
    });

    test('skips validation entirely when the validate option is false', () => {
        const {emitter, fired} = setup();

        expect(validateAndEmit(emitter, validateFilter, {key, value: 'notafilter'}, {validate: false})).toBe(false);
        expect(fired).toEqual([]);
    });
});

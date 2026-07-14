import {describe, test, expect, vi, afterEach} from 'vitest';
import {validateAndEmit, validateFilter, validateSource} from './validate_style.ts';
import {Evented} from '../util/evented.ts';

class TestEmitter extends Evented {}

afterEach(() => {
    vi.restoreAllMocks();
});

/** An emitter collecting the messages of the {@link ErrorEvent}s fired at it, plus a `console.warn` spy. */
function setup() {
    const emitter = new TestEmitter();
    const fired: string[] = [];
    emitter.on('error', ({error}) => fired.push(error.message));
    return {emitter, fired, warn: vi.spyOn(console, 'warn').mockImplementation(() => {})};
}

describe('validateAndEmit', () => {
    const key = 'layers.symbol.filter';

    test('fires an error and reports failure for a filter the spec rejects', () => {
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

    test('still fails when an error accompanies a warning, emitting only the error', () => {
        const {emitter, fired, warn} = setup();

        // `!in` has no expression equivalent, so the spec reports it as an error on top of the
        // warning about the mixing itself. A warning must not swallow that error.
        const hasErrors = validateAndEmit(emitter, validateFilter, {
            key,
            value: ['all', ['==', ['get', 'class'], 'rail'], ['!in', 'name', 'a']]
        });

        expect(hasErrors).toBe(true);
        expect(fired).toEqual([expect.stringContaining('Unknown expression "!in"')]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Mixing deprecated filter syntax with expression syntax'));
    });

    test('ignores errors about canvas sources, which are added at runtime instead', () => {
        const {emitter, fired} = setup();

        const hasErrors = validateAndEmit(emitter, validateSource, {
            key: 'sources.canvas',
            value: {type: 'canvas'}
        });

        expect(hasErrors).toBe(false);
        expect(fired).toEqual([]);
    });

    test('skips validation entirely when the validate option is false', () => {
        const {emitter, fired} = setup();

        expect(validateAndEmit(emitter, validateFilter, {key, value: 'notafilter'}, {validate: false})).toBe(false);
        expect(fired).toEqual([]);
    });
});

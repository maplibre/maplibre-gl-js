import {describe, test, expect, vi, afterEach} from 'vitest';
import {emitValidationErrors, validateAndEmit, validateFilter} from './validate_style.ts';
import {Evented} from '../util/evented.ts';

class TestEmitter extends Evented {}

// Mixes a legacy sub-filter (`["in", "name", ""]`) into an expression tree, which the style spec
// reports as a warning. See https://github.com/maplibre/maplibre-style-spec/issues/1751
const mixedLegacyAndExpressionFilter = ['all', ['==', ['get', 'class'], 'rail'], ['in', 'name', '']];

describe('emitValidationErrors', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('reports no failure when there is nothing to emit', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);

        expect(emitValidationErrors(evented, [])).toBe(false);
        expect(emitValidationErrors(evented, null)).toBe(false);
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test('fires an error event and reports failure for an error', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);

        const hasErrors = emitValidationErrors(evented, [
            {message: 'layers[0].filter[2][0]: Unknown expression "nope".', severity: 'error'}
        ]);

        expect(hasErrors).toBe(true);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0].error.message).toBe('layers[0].filter[2][0]: Unknown expression "nope".');
    });

    test('logs a warning instead of failing, so the style keeps loading', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const hasErrors = emitValidationErrors(evented, [
            {message: 'layers[0].filter[2]: Mixing deprecated filter syntax with expression syntax is not supported.', severity: 'warning'}
        ]);

        expect(hasErrors).toBe(false);
        expect(errorSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith('layers[0].filter[2]: Mixing deprecated filter syntax with expression syntax is not supported.');
    });

    test('reports failure when an error is mixed in with a warning, emitting only the error', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const hasErrors = emitValidationErrors(evented, [
            {message: 'a mixed filter warning', severity: 'warning'},
            {message: 'a genuine error', severity: 'error'}
        ]);

        expect(hasErrors).toBe(true);
        expect(warnSpy).toHaveBeenCalledWith('a mixed filter warning');
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0].error.message).toBe('a genuine error');
    });

    test('treats an error without a severity as an error', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);

        expect(emitValidationErrors(evented, [{message: 'no severity given'}])).toBe(true);
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    test('skips errors about canvas sources, which are added at runtime', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);

        const hasErrors = emitValidationErrors(evented, [
            {message: 'sources.canvas: unknown source type', identifier: 'source.canvas', severity: 'error'}
        ]);

        expect(hasErrors).toBe(false);
        expect(errorSpy).not.toHaveBeenCalled();
    });
});

describe('validateAndEmit', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('reports failure and fires an error event for an invalid value', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);

        const hasErrors = validateAndEmit(evented, validateFilter, {
            key: 'layers.symbol.filter',
            value: ['all', ['==', ['get', 'class'], 'rail'], ['nope', 1]]
        });

        expect(hasErrors).toBe(true);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0].error.message).toMatch(/Unknown expression "nope"/);
    });

    test('warns without failing for a filter that mixes legacy and expression syntax', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const hasErrors = validateAndEmit(evented, validateFilter, {
            key: 'layers.symbol.filter',
            value: mixedLegacyAndExpressionFilter
        });

        expect(hasErrors).toBe(false);
        expect(errorSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Mixing deprecated filter syntax with expression syntax'));
    });

    test('skips validation entirely when the validate option is false', () => {
        const evented = new TestEmitter();
        const errorSpy = vi.fn();
        evented.on('error', errorSpy);

        const hasErrors = validateAndEmit(evented, validateFilter, {
            key: 'layers.symbol.filter',
            value: 'notafilter'
        }, {validate: false});

        expect(hasErrors).toBe(false);
        expect(errorSpy).not.toHaveBeenCalled();
    });
});

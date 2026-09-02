import {describe, test, expect} from 'vitest';
import {verticalizePunctuation} from './verticalize_punctuation.ts';

describe('verticalizePunctuation', () => {
    test('preserves characters without fullwidth variants', () => {
        expect(verticalizePunctuation('ABC123')).toBe('ABC123');
    });
    test('replaces punctuation marks with fullwidth variants', () => {
        expect(verticalizePunctuation('!?')).toBe('︕︖');
    });
    test('replaces rotatable punctuation marks', () => {
        expect(verticalizePunctuation('(…)')).toBe('︵︙︶');
        expect(verticalizePunctuation('（⋯）')).toBe('︵︙︶');
    });
});

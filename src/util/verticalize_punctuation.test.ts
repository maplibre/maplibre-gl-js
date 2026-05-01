import {describe, test, expect} from 'vitest';
import {verticalizePunctuation} from './verticalize_punctuation';

describe('verticalizePunctuation', () => {
    test('preserves characters without fullwidth variants', () => {
        expect(verticalizePunctuation('ABC123')).toEqual('ABC123');
    });
    test('replaces punctuation marks with fullwidth variants', () => {
        expect(verticalizePunctuation('!?')).toEqual('︕︖');
    });
    test('replaces rotatable punctuation marks', () => {
        expect(verticalizePunctuation('(…)')).toEqual('︵︙︶');
        expect(verticalizePunctuation('（⋯）')).toEqual('︵︙︶');
    });
});

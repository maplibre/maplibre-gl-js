import {describe, test, expect} from 'vitest';
import {TaggedString, type TextSectionOptions} from './tagged_string';

describe('TaggedString', () => {
    const textSection = {
        scale: 1,
        verticalAlign: 'bottom',
        fontStack: 'Test',
    } as TextSectionOptions;

    describe('length', () => {
        test('counts a surrogate pair as a single character', () => {
            const tagged = new TaggedString('茹𦨭');
            expect(tagged.length()).toBe(2);
        });
    });

    describe('hasZeroWidthSpaces', () => {
        test('detects a zero width space', () => {
            const tagged = new TaggedString('三三\u200b三三\u200b三三\u200b三三三三三三\u200b三三');
            expect(tagged.hasZeroWidthSpaces()).toBeTruthy();
        });
    });

    describe('trim', () => {
        test('turns a whitespace-only string into the empty string', () => {
            const tagged = new TaggedString('  \t    \v ', [textSection], Array(9).fill(0));
            tagged.trim();
            expect(tagged.text).toBe('');
            expect(tagged.sectionIndex).toHaveLength(0);
        });

        test('trims whitespace around a surrogate pair', () => {
            const tagged = new TaggedString(' 茹𦨭 ', [textSection], Array(4).fill(0));
            tagged.trim();
            expect(tagged.text).toBe('茹𦨭');
            expect(tagged.sectionIndex).toHaveLength(2);
        });
    });

    describe('substring', () => {
        test('avoids splitting a surrogate pair', () => {
            const tagged = new TaggedString('𰻞𰻞麵𪚥𪚥', [textSection], Array(5).fill(0));
            expect(tagged.substring(0, 1).text).toBe('𰻞');
            expect(tagged.substring(0, 1).sectionIndex).toEqual([0]);
            expect(tagged.substring(0, 2).text).toBe('𰻞𰻞');
            expect(tagged.substring(0, 2).sectionIndex).toEqual([0, 0]);
            expect(tagged.substring(1, 2).text).toBe('𰻞');
            expect(tagged.substring(1, 2).sectionIndex).toEqual([0]);
            expect(tagged.substring(1, 3).text).toBe('𰻞麵');
            expect(tagged.substring(1, 3).sectionIndex).toEqual([0, 0]);
            expect(tagged.substring(2, 5).text).toBe('麵𪚥𪚥');
            expect(tagged.substring(2, 5).sectionIndex).toEqual([0, 0, 0]);
        });
    });

    describe('codeUnitIndex', () => {
        test('splits surrogate pairs', () => {
            const tagged = new TaggedString('𰻞𰻞麵𪚥𪚥');
            expect(tagged.toCodeUnitIndex(0)).toBe(0);
            expect(tagged.toCodeUnitIndex(1)).toBe(2);
            expect(tagged.toCodeUnitIndex(2)).toBe(4);
            expect(tagged.toCodeUnitIndex(3)).toBe(5);
            expect(tagged.toCodeUnitIndex(4)).toBe(7);
            expect(tagged.toCodeUnitIndex(5)).toBe(9);
        });
    });
});

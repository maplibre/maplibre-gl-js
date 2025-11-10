import {describe, test, expect} from 'vitest';

import type {StyleGlyph} from '../style/style_glyph';
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

    describe('determineLineBreaks', () => {
        const metrics = {
            width: 22,
            height: 18,
            left: 0,
            top: -8,
            advance: 22,
        };
        const rect = {
            x: 0,
            y: 0,
            w: 32,
            h: 32,
        };
        const glyphs = {
            'Test': {
                '97': {id: 0x61, metrics, rect},
                '98': {id: 0x62, metrics, rect},
                '99': {id: 0x63, metrics, rect},
                '40629': {id: 0x9EB5, metrics, rect},
                '200414': {id: 0x30EDE, metrics, rect},
            } as any as StyleGlyph,
        };
        const textSection = {
            scale: 1,
            verticalAlign: 'bottom',
            fontStack: 'Test',
        } as TextSectionOptions;

        test('keeps alphabetic characters together', () => {
            const tagged = new TaggedString('abc', [textSection], Array(3).fill(0));
            expect(tagged.determineLineBreaks(0, 300, glyphs, {}, 30)).toEqual([3]);
        });

        test('keeps ideographic characters together', () => {
            const tagged = new TaggedString('𰻞𰻞麵', [textSection], Array(3).fill(0));
            expect(tagged.determineLineBreaks(0, 300, glyphs, {}, 30)).toEqual([3]);
        });
    });
});

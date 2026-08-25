import {describe, expect, test} from 'vitest';
import {isCluster, supportsGraphemeSegmentation, toGraphemes} from './graphemes.ts';

describe('toGraphemes', () => {
    test('leaves plain text one unit per character', () => {
        expect(toGraphemes('Tel Aviv')).toEqual(['T', 'e', 'l', ' ', 'A', 'v', 'i', 'v']);
    });

    test('keeps a letter and its combining mark together', () => {
        // e followed by U+0301 combining acute accent.
        expect(toGraphemes('é')).toEqual(['é']);
    });

    test('keeps a Hebrew letter and its vowel points together', () => {
        // שׁ with a sheva and a shin dot: one letter as it is written, three codepoints as it is stored.
        expect(toGraphemes('שְׁ')).toEqual(['שְׁ']);
        expect(toGraphemes('שְׁדֵ')).toEqual(['שְׁ', 'דֵ']);
    });

    test('keeps a Devanagari syllable together, including a conjunct', () => {
        // दिल्ली: the vowel sign of the first syllable is written before its consonant, and the
        // second is three consonants fused into one shape.
        expect(toGraphemes('दिल्ली')).toEqual(['दि', 'ल्ली']);
    });

    test('keeps a Khmer syllable with a subscript consonant together', () => {
        expect(toGraphemes('ភ្នំ')).toEqual(['ភ្នំ']);
    });

    test('does not split a character outside the basic plane', () => {
        expect(toGraphemes('\u{30EDE}\u{30EDE}')).toEqual(['\u{30EDE}', '\u{30EDE}']);
    });

    test('handles the empty string', () => {
        expect(toGraphemes('')).toEqual([]);
    });
});

describe('isCluster', () => {
    test('is false for a single character, inside the basic plane or outside it', () => {
        expect(isCluster('a')).toBe(false);
        expect(isCluster(' ')).toBe(false);
        expect(isCluster('麵')).toBe(false);
        expect(isCluster('\u{30EDE}')).toBe(false);
    });

    test('is true for a character written with marks on it', () => {
        expect(isCluster('é')).toBe(true);
        expect(isCluster('שְׁ')).toBe(true);
        expect(isCluster('\u{30EDE}́')).toBe(true);
    });
});

test('the environment can segment graphemes', () => {
    // Everything above falls back to one codepoint at a time without it, so a failure here is worth
    // knowing about rather than silently passing.
    expect(supportsGraphemeSegmentation).toBe(true);
});

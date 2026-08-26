import {describe, expect, test} from 'vitest';
import {isCluster, supportsGraphemeSegmentation, toGraphemes, wordBoundaries} from './graphemes.ts';

describe('toGraphemes', () => {
    test('leaves plain text one unit per character', () => {
        expect(toGraphemes('Tel Aviv')).toEqual(['T', 'e', 'l', ' ', 'A', 'v', 'i', 'v']);
    });

    test('keeps a letter and the combining mark written on it together', () => {
        expect(toGraphemes('é')).toEqual(['é']);
    });

    test('keeps a Hebrew letter and its vowel points together: one letter, three codepoints', () => {
        expect(toGraphemes('שְׁ')).toEqual(['שְׁ']);
        expect(toGraphemes('שְׁדֵ')).toEqual(['שְׁ', 'דֵ']);
    });

    test('keeps a Devanagari syllable together, vowel sign written before its consonant and all', () => {
        expect(toGraphemes('दिल्ली')).toEqual(['दि', 'ल्ली']);
    });

    test('keeps a Khmer syllable with a subscript consonant together', () => {
        expect(toGraphemes('ភ្នំ')).toEqual(['ភ្នំ']);
    });

    test('keeps a Burmese syllable together across the spacing-mark boundaries the segmenter tailors in', () => {
        expect(toGraphemes('ဘင်္ဂလားဒေ့ရှ်')).toEqual(['ဘ', 'င်္ဂ', 'လား', 'ဒေ့', 'ရှ်']);
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

test('the environment can segment graphemes, so that the tests above are not silently vacuous', () => {
    expect(supportsGraphemeSegmentation).toBe(true);
});

describe('wordBoundaries', () => {
    test('finds where each word of spaced text begins', () => {
        expect([...wordBoundaries('Tel Aviv')].sort((a, b) => a - b)).toEqual([0, 3, 4]);
    });

    test('finds the words of Thai, which spaces none of them, from the browser dictionary', () => {
        expect(wordBoundaries('ราชอาณาจักรไทย').has('ราชอาณาจักร'.length)).toBe(true);
    });

    test('offers a break at a newline, whether or not a carriage return precedes it', () => {
        expect(wordBoundaries('ab\ncd').has(3)).toBe(true);
        expect(wordBoundaries('ab\r\ncd').has(4)).toBe(true);
    });

    test('offers a break at a zero-width space, which some tilesets insert as a hint', () => {
        expect(wordBoundaries('三三\u200b三三').has(3)).toBe(true);
    });

    test('handles the empty string', () => {
        expect([...wordBoundaries('')]).toEqual([]);
    });
});

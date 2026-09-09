import {describe, expect, test} from 'vitest';
import {applyArabicShaping} from './arabic_shaping.ts';

/** Spells out a result as code points, so a failure says which shape came back rather than showing look-alike glyphs. */
function codePoints(text: string): string[] {
    return [...text].map(character => character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
}

const BEH = 'ب';
const LAM = 'ل';
const ALEF = 'ا';
const HAMZA = 'ء';
const FATHA = 'َ';
const DAMMATAN = 'ٌ';
const ZWNJ = '‌';

describe('applyArabicShaping', () => {
    test('leaves text with no Arabic in it alone', () => {
        expect(applyArabicShaping('hello world')).toBe('hello world');
        expect(applyArabicShaping('שלום')).toBe('שלום');
        expect(applyArabicShaping('')).toBe('');
    });

    test('writes a lone letter in the shape it takes standing by itself', () => {
        expect(codePoints(applyArabicShaping(BEH))).toEqual(['FE8F']);
    });

    test('opens, continues and closes a word as the letters reach each other', () => {
        expect(codePoints(applyArabicShaping(BEH + BEH + BEH))).toEqual(['FE91', 'FE92', 'FE90']);
    });

    test('stops joining at a letter that only reaches backwards', () => {
        expect(codePoints(applyArabicShaping(BEH + ALEF + BEH))).toEqual(['FE91', 'FE8E', 'FE8F']);
    });

    test('leaves a letter that never joins as it was written', () => {
        expect(codePoints(applyArabicShaping(BEH + HAMZA + BEH))).toEqual(['FE8F', '0621', 'FE8F']);
    });

    test('writes lam followed by alef as the single character the pair is written as', () => {
        expect(codePoints(applyArabicShaping(LAM + ALEF))).toEqual(['FEFB']);
        expect(codePoints(applyArabicShaping(BEH + LAM + ALEF))).toEqual(['FE91', 'FEFC']);
    });

    test('joins across a vowel point, and gives the point the shape it takes over the letter', () => {
        expect(codePoints(applyArabicShaping(BEH + FATHA + BEH))).toEqual(['FE91', 'FE77', 'FE90']);
        expect(codePoints(applyArabicShaping(BEH + FATHA))).toEqual(['FE8F', 'FE76']);
    });

    test('falls back to the one shape a vowel point has where it has no other', () => {
        expect(codePoints(applyArabicShaping(BEH + DAMMATAN + BEH))).toEqual(['FE91', 'FE72', 'FE90']);
    });

    test('stops joining at a zero width non-joiner, which is there to say so', () => {
        expect(codePoints(applyArabicShaping(BEH + ZWNJ + BEH))).toEqual(['FE8F', '200C', 'FE8F']);
    });

    test('shapes the Arabic in a sentence and leaves the rest of it alone', () => {
        expect(applyArabicShaping('hello مرحبا 123')).toBe('hello ﻣﺮﺣﺒﺎ 123');
    });
});

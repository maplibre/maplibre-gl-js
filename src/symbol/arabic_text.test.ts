import {describe, expect, test} from 'vitest';
import {isArabicCodePoint, joinArabicWords, withoutArabicJoiners} from './arabic_text.ts';

const ZWJ = '\u200d';
const ZWNJ = '\u200c';

describe('joinArabicWords', () => {
    test('leaves text with no Arabic in it alone', () => {
        expect(joinArabicWords('hello 123')).toBe('hello 123');
    });

    test('holds the letters of a word together, including a Kurdish letter, with joiners', () => {
        expect(joinArabicWords('ڵا')).toBe(`ڵ${ZWJ}ا`);
        expect(joinArabicWords('هەولێر')).toBe(['ه', 'ە', 'و', 'ل', 'ێ', 'ر'].join(ZWJ));
    });

    test('ends a word at a space and at a non-joiner', () => {
        expect(joinArabicWords('لا لا')).toBe(`ل${ZWJ}ا ل${ZWJ}ا`);
        expect(joinArabicWords(`ب${ZWNJ}ب`)).toBe(`ب${ZWNJ}ب`);
    });

    test('keeps a vowel point with its letter and the letters around it', () => {
        expect(joinArabicWords('بَب')).toBe(`ب${ZWJ}َ${ZWJ}ب`);
    });

    test('joins the Arabic in a sentence and leaves the rest of it alone', () => {
        expect(joinArabicWords('hello لا 123')).toBe(`hello ل${ZWJ}ا 123`);
    });

    test('leaves text already written in presentation forms alone', () => {
        expect(joinArabicWords('ﻣﺮﺣﺒﺎ')).toBe('ﻣﺮﺣﺒﺎ');
    });
});

describe('withoutArabicJoiners', () => {
    test('takes back the joiners between Arabic characters and no others', () => {
        expect(withoutArabicJoiners(joinArabicWords('هەولێر'))).toBe('هەولێر');
        expect(withoutArabicJoiners(`a${ZWJ}b`)).toBe(`a${ZWJ}b`);
    });
});

describe('isArabicCodePoint', () => {
    test('is true of Arabic letters and false of others', () => {
        expect(isArabicCodePoint('ڵ'.codePointAt(0))).toBe(true);
        expect(isArabicCodePoint('a'.codePointAt(0))).toBe(false);
        expect(isArabicCodePoint('ﻣ'.codePointAt(0))).toBe(false);
    });
});

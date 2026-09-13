import {describe, expect, test} from 'vitest';
import {processBidirectionalText, processStyledBidirectionalText} from './bidi.ts';

/** The section each code unit belongs to, where every character is its own section. */
function oneSectionPerCharacter(text: string): number[] {
    return [...text].flatMap((character, index) => Array(character.length).fill(index));
}

const RLM = '‏';
const NO_LINE_BREAKS: number[] = [];

describe('processBidirectionalText', () => {
    test('leaves left-to-right text in the order it was written', () => {
        expect(processBidirectionalText('hello world', NO_LINE_BREAKS)).toEqual(['hello world']);
    });

    test('reverses right-to-left text', () => {
        expect(processBidirectionalText('שלום', NO_LINE_BREAKS)).toEqual(['םולש']);
    });

    test('reverses only the right-to-left run of a left-to-right sentence', () => {
        expect(processBidirectionalText('hello שלום world', NO_LINE_BREAKS)).toEqual(['hello םולש world']);
    });

    test('reads a sentence from the right when that is where it starts', () => {
        expect(processBidirectionalText('שלום hello עולם', NO_LINE_BREAKS)).toEqual(['םלוע hello םולש']);
    });

    test('keeps a number readable inside right-to-left text', () => {
        expect(processBidirectionalText('שלום 123', NO_LINE_BREAKS)).toEqual(['123 םולש']);
    });

    test('turns a bracket around where it is read from the other side', () => {
        expect(processBidirectionalText('שלום (עולם)', NO_LINE_BREAKS)).toEqual(['(םלוע) םולש']);
    });

    test('breaks the text where it is asked to, and orders each line on its own', () => {
        expect(processBidirectionalText('שלום עולם טוב', [5, 10])).toEqual([' םולש', ' םלוע', 'בוט']);
    });

    test('puts the space a right-to-left line ends with on the left, where the line ends', () => {
        expect(processBidirectionalText('שלום ', NO_LINE_BREAKS)).toEqual([' םולש']);
    });

    test('drops the characters that steer the reading order without being written', () => {
        expect(processBidirectionalText(`hello${RLM}world`, NO_LINE_BREAKS)).toEqual(['helloworld']);
    });

    test('keeps both halves of a character from outside the basic plane together', () => {
        expect(processBidirectionalText('שלום 😀 עולם', NO_LINE_BREAKS)).toEqual(['םלוע 😀 םולש']);
    });
});

describe('processStyledBidirectionalText', () => {
    test('gives every code unit of the reordered line the section it came from', () => {
        const text = 'ab שלום';
        const [[line, sections]] = processStyledBidirectionalText(
            text, oneSectionPerCharacter(text), NO_LINE_BREAKS);

        expect(line).toBe('ab םולש');
        expect(sections).toEqual([0, 1, 2, 6, 5, 4, 3]);
    });

    test('carries the sections of a character from outside the basic plane on both its code units', () => {
        const text = '😀ש';
        const [[line, sections]] = processStyledBidirectionalText(
            text, oneSectionPerCharacter(text), NO_LINE_BREAKS);

        expect(line).toBe('😀ש');
        expect(sections).toEqual([0, 0, 1]);
    });

    test('returns the same lines as the plain version does', () => {
        const text = 'שלום hello עולם';
        const styled = processStyledBidirectionalText(text, oneSectionPerCharacter(text), [5]);

        expect(styled.map(([line]) => line)).toEqual(processBidirectionalText(text, [5]));
    });

    test('drops the sections of the characters it drops', () => {
        const text = `ab${RLM}cd`;
        const [[line, sections]] = processStyledBidirectionalText(
            text, oneSectionPerCharacter(text), NO_LINE_BREAKS);

        expect(line).toBe('abcd');
        expect(sections).toEqual([0, 1, 3, 4]);
    });
});

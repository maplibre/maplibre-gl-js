import {describe, test, expect} from 'vitest';
import {charIsWhitespace, charAllowsLetterSpacing, charInComplexShapingScript, charInRTLScript} from './script_detection';

describe('charIsWhitespace', () => {
    test('detects whitespace', () => {
        expect(charIsWhitespace(' '.codePointAt(0))).toBe(true);
        expect(charIsWhitespace('\t'.codePointAt(0))).toBe(true);
        expect(charIsWhitespace('\v'.codePointAt(0))).toBe(true);
        expect(charIsWhitespace('\f'.codePointAt(0))).toBe(true);
        expect(charIsWhitespace('\r'.codePointAt(0))).toBe(true);
        expect(charIsWhitespace('\n'.codePointAt(0))).toBe(true);
    });
});

describe('charAllowsLetterSpacing', () => {
    test('allows letter spacing of Latin text', () => {
        expect(charAllowsLetterSpacing('A'.codePointAt(0))).toBe(true);
    });

    test('disallows ideographic breaking of Arabic text', () => {
        // Arabic
        expect(charAllowsLetterSpacing('۳'.codePointAt(0))).toBe(false);
        // Arabic Supplement
        expect(charAllowsLetterSpacing('ݣ'.codePointAt(0))).toBe(false);
        // Arabic Extended-A
        expect(charAllowsLetterSpacing('ࢳ'.codePointAt(0))).toBe(false);
        // Arabic Extended-B
        expect(charAllowsLetterSpacing('࢐'.codePointAt(0))).toBe(false);
        // Arabic Presentation Forms-A
        expect(charAllowsLetterSpacing('ﰤ'.codePointAt(0))).toBe(false);
        // Arabic Presentation Forms-B
        expect(charAllowsLetterSpacing('ﺽ'.codePointAt(0))).toBe(false);
    });
});

describe('charInComplexShapingScript', () => {
    test('recognizes that Arabic text needs complex shaping', () => {
        // Non-Arabic
        expect(charInComplexShapingScript('3'.codePointAt(0))).toBe(false);
        // Arabic
        expect(charInComplexShapingScript('۳'.codePointAt(0))).toBe(true);
        // Arabic Supplement
        expect(charInComplexShapingScript('ݣ'.codePointAt(0))).toBe(true);
        // Arabic Extended-A
        expect(charInComplexShapingScript('ࢳ'.codePointAt(0))).toBe(true);
        // Arabic Extended-B
        expect(charInComplexShapingScript('࢐'.codePointAt(0))).toBe(true);
        // Arabic Presentation Forms-A
        expect(charInComplexShapingScript('ﰤ'.codePointAt(0))).toBe(true);
        // Arabic Presentation Forms-B
        expect(charInComplexShapingScript('ﺽ'.codePointAt(0))).toBe(true);
    });
});

describe('charInRTLScript', () => {
    test('does not identify direction-neutral text as right-to-left', () => {
        expect(charInRTLScript('3'.codePointAt(0))).toBe(false);
    });

    test('identifies Arabic text as right-to-left', () => {
        // Arabic
        expect(charInRTLScript('۳'.codePointAt(0))).toBe(true);
        // Arabic Supplement
        expect(charInRTLScript('ݣ'.codePointAt(0))).toBe(true);
        // Arabic Extended-A
        expect(charInRTLScript('ࢳ'.codePointAt(0))).toBe(true);
        // Arabic Extended-B
        expect(charInRTLScript('࢐'.codePointAt(0))).toBe(true);
        // Arabic Presentation Forms-A
        expect(charInRTLScript('ﰤ'.codePointAt(0))).toBe(true);
        // Arabic Presentation Forms-B
        expect(charInRTLScript('ﺽ'.codePointAt(0))).toBe(true);
    });

    test('identifies Hebrew text as right-to-left', () => {
        // Hebrew
        expect(charInRTLScript('ה'.codePointAt(0))).toBe(true);
        // Alphabetic Presentation Forms
        expect(charInRTLScript('ﬡ'.codePointAt(0))).toBe(true);
    });

    test('identifies Thaana text as right-to-left', () => {
        // Thaana
        expect(charInRTLScript('ޘ'.codePointAt(0))).toBe(true);
    });
});

import {charInComplexShapingScript} from './script_detection';

describe('charInComplexShapingScript', () => {
    test('recognizes that Arabic text needs complex shaping', () => {
        expect(charInComplexShapingScript('3'.codePointAt(0))).toBe(false);
        expect(charInComplexShapingScript('۳'.codePointAt(0))).toBe(true);
        expect(charInComplexShapingScript('࢐'.codePointAt(0))).toBe(true);
    });
});

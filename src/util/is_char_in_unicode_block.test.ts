import {unicodeBlockLookup} from './is_char_in_unicode_block';

describe('unicodeBlockLookup', () => {
    test('each code block lookup function follows the same pattern', () => {
        for (const codeBlock in unicodeBlockLookup) {
            const lookup = unicodeBlockLookup[codeBlock];
            const match = lookup.toString().match(/^\(char\) => char >= 0x([0-9A-F]{4,6}) && char <= 0x([0-9A-F]{4,6})$/);
            expect(match).not.toBeNull();
            expect(match).toHaveLength(3);
            const lower = parseInt(match[1], 16);
            const upper = parseInt(match[2], 16);
            expect(upper).toBeGreaterThan(lower);
        }
    });
});

import {describe, test, expect} from 'vitest';
import {unicodeBlockLookup} from './is_char_in_unicode_block';

describe('unicodeBlockLookup', () => {
    test('each code block lookup function follows the same pattern', () => {
        for (const codeBlock in unicodeBlockLookup) {
            const lookup = unicodeBlockLookup[codeBlock];
            const lookupString = lookup.toString();
            console.log(`Checking code block: ${codeBlock}, function: ${lookupString}`);
            const match = lookupString.match(/^\(char\) => char >= (\d+) && char <= (\d+)$/);
            expect(match).not.toBeNull();
            expect(match).toHaveLength(3);
            const lower = parseInt(match[1], 10);
            const upper = parseInt(match[2], 10);
            expect(upper).toBeGreaterThan(lower);
        }
    });
});
